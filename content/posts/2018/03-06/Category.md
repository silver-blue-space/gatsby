---
title: 从源码解读Category实现原理
cover: cover.png
author: westwood
date: 2018-03-06
series: ios
tags: [ios]
draft: false
---


### 什么是category？
category是 Objective-C 2.0 之后添加的语言特性，主要作用是为已经存在的类添加方法。除此之外，Apple 还推荐了category 的另外两个使用场景。

1. 可以把类的实现分开在几个不同的文件里面。这样做有几个显而易见的好处
	* 可以减少单个文件的体积
	* 可以把不同的功能组织到不同的 category 里
	* 可以由多个开发者共同完成一个类
	* 可以按需加载想要的 category 等等
2. 声明私有方法

不过除了apple推荐的使用场景，还衍生出了 category 的其他几个使用场景：

* 模拟多继承
* 把framework的私有方法公开

### category特点

* category 只能给某个已有的类扩充方法，不能扩充成员变量
* category 中也可以添加属性，只不过 `@property` 只会生成 `setter` 和 `getter` 的声明，不会生成 `setter` 和 `getter` 的实现以及成员变量
* 如果 category 中的方法和类中原有方法同名，category 中的方法会覆盖掉类中原有的方法
* 如果多个 category 中存在同名的方法，运行时到底调用哪个方法由编译器决定，后面参与编译的方法会覆盖前面同名的方法，所以最后一个参与编译的方法会被调用

> 这里说的是覆盖而不是替换，是因为后编译的方法被放在了方法列表的前面而已，runtime机制先找到前面的方法来执行


### `Category`  VS  `Extension`

category 常常拿来与 extension 做比较，extension 一样可以添加属性和方法，extension 看起来很像一个匿名的 category。但实际上两者几乎完全是两个东西

* extension 运行在编译期，它就是类的一部分，拓展的方法，属性和变量一起形成一个完整的类。category 是运行期决议的，此时对象的内存布局已经确定，无法再添加实例变量
* extension 一般用来隐藏类的私有信息，你必须有一个类的源码才能为一个类添加 extension
* extension 和 category 都可以添加属性，但是 category 的属性不能生成成员变量和 getter、setter 方法的实现

### category原理

讲了一堆category的作用和特点，我们来看一下category的定义

``` C++
typedef struct category_t *Category;

struct category_t {
    const char *name;	//category名称
    classref_t cls; 	//要拓展的类
    struct method_list_t *instanceMethods; //给类添加的实例方法的列表
    struct method_list_t *classMethods;  //给类添加的类方法的列表
    struct protocol_list_t *protocols;  //给类添加的协议的列表
    struct property_list_t *instanceProperties;  //给类添加的属性的列表
};

```

实际上 `Category` 是一个 `category_t` 的结构体，里面维护着类的信息和category的名称，以及类方法列表，实例方法列表，协议的列表和属性的列表

那么Category是怎么加载的呢？

我们知道，Objective-C 的运行是依赖 OC 的 runtime 的， 而 OC 的 runtime 和其他系统库一样，是OS X和iOS通过[dyld](https://opensource.apple.com/tarballs/objc4/objc4-723.tar.gz)动态加载的

我们从OC运行时，入口方法出发

``` C++
void _objc_init(void)
{
    static bool initialized = false;
    if (initialized) return;
    initialized = true;
    
    // fixme defer initialization until an objc-using image is found?
    environ_init();
    tls_init();
    static_init();
    lock_init();
    exception_init();

    _dyld_objc_notify_register(&map_images, load_images, unmap_image);
}
```

到真正完成绑定 category 的函数`attachCategories`中间的函数调用栈是

```
void _objc_init(void);
└── void map_images(...);
    └── void map_images_nolock(...);
        └── void _read_images(...);
            └── void _read_images(...);
                └── static void remethodizeClass(Class cls);
                    └──attachCategories(Class cls, category_list *cats, bool flush_caches);
```

我们来看一下 `attachCategories` 源码的简易版：

``` C++
static void 
attachCategories(Class cls, category_list *cats, bool flush_caches)
{
    if (!cats) return;
    
    bool isMeta = cls->isMetaClass();

    method_list_t **mlists = (method_list_t **)
        malloc(cats->count * sizeof(*mlists));

    int mcount = 0;
    int i = cats->count;
    bool fromBundle = NO;
    while (i--) {
        auto& entry = cats->list[i];

        method_list_t *mlist = entry.cat->methodsForMeta(isMeta);
        if (mlist) {
            mlists[mcount++] = mlist;
            fromBundle |= entry.hi->isBundle();
        }
    }

    auto rw = cls->data();

    prepareMethodLists(cls, mlists, mcount, NO, fromBundle);
    rw->methods.attachLists(mlists, mcount);
    free(mlists);
    if (flush_caches  &&  mcount > 0) flushCaches(cls);
}
```

从上面的代码可以看出，增加方法的操作实际是分配一个大的实例方法列表
 `method_list_t **mlists = (method_list_t **)
        malloc(cats->count * sizeof(*mlists));` 再通过 for 循环将category中的方法列表填入这个大的列表，最后交给 ` rw->methods.attachLists(mlists, mcount);`将方法列表增加到类的方法列表上去。其他的属性添加与此类似
        
我们再看一段 ` attachLists`的源码

``` C++
void attachLists(List* const * addedLists, uint32_t addedCount) {
 if (hasArray()) {
        
        //旧的方法列表的长度
        uint32_t oldCount = array()->count;
        
        //新的方法列表的长度
        uint32_t newCount = oldCount + addedCount;
        
        setArray((array_t *)realloc(array(), array_t::byteSize(newCount)));
        array()->count = newCount;
        
        //从addedCount的偏移量添加旧的方法列表
        memmove(array()->lists + addedCount, array()->lists, 
                oldCount * sizeof(array()->lists[0]));
        //从开始添加新方法列表
        memcpy(array()->lists, addedLists, 
               addedCount * sizeof(array()->lists[0]));
        }
}
```

> 从上面的代码也验证了我们上面所说的，同名的方法是覆盖而不是替换，category的方法被放到了新方法列表的前面




### category和关联对象

如上所述，category 的属性不能生成成员变量和 `getter`、`setter` 方法的实现，我们要自己实现 `getter` 和 `setter` 方法，需借助关联对象来实现

关联对象来实现提供三个接口 `objc_setAssociatedObject`,`objc_getAssociatedObject`,`objc_removeAssociatedObjects`,他们分别调用的是

``` C++
id objc_getAssociatedObject(id object, const void *key) {
    return _object_get_associative_reference(object, (void *)key);
}

void objc_setAssociatedObject(id object, const void *key, id value, objc_AssociationPolicy policy) {
    _object_set_associative_reference(object, (void *)key, value, policy);
}

void objc_removeAssociatedObjects(id object) 
{
    if (object && object->hasAssociatedObjects()) {
        _object_remove_assocations(object);
    }
}
```

他们调用的接口都位于 ` objc-references.mm`文件中,

##### _object_get_associative_reference

``` C++
id _object_get_associative_reference(id object, void *key) {
    id value = nil;
    uintptr_t policy = OBJC_ASSOCIATION_ASSIGN;
    {
        AssociationsManager manager;
        AssociationsHashMap &associations(manager.associations());
        disguised_ptr_t disguised_object = DISGUISE(object);
        AssociationsHashMap::iterator i = associations.find(disguised_object);
        if (i != associations.end()) {
            ObjectAssociationMap *refs = i->second;
            ObjectAssociationMap::iterator j = refs->find(key);
            if (j != refs->end()) {
                ObjcAssociation &entry = j->second;
                value = entry.value();
                policy = entry.policy();
                if (policy & OBJC_ASSOCIATION_GETTER_RETAIN) {
                    objc_retain(value);
                }
            }
        }
    }
    if (value && (policy & OBJC_ASSOCIATION_GETTER_AUTORELEASE)) {
        objc_autorelease(value);
    }
    return value;
}
```

这段代码引用的类型有

* AssociationsManager
* AssociationsHashMap
* ObjcAssociationMap
* ObjcAssociation

**AssociationsManager源码**

``` C++
spinlock_t AssociationsManagerLock;

class AssociationsManager {
    static AssociationsHashMap *_map;
public:
    // 初始化时候
    AssociationsManager()   { AssociationsManagerLock.lock(); }
    // 析构的时候
    ~AssociationsManager()  { AssociationsManagerLock.unlock(); }
    
    // associations 方法用于取得一个全局的 AssociationsHashMap 单例
    AssociationsHashMap &associations() {
        if (_map == NULL)
            _map = new AssociationsHashMap();
        return *_map;
    }
};
```

AssociationsManager 初始化一个 `AssociationsHashMap` 的单例，用自旋锁 `AssociationsManagerLock` 保证线程安全

**AssociationsHashMap源码**

``` C++
class AssociationsHashMap : public unordered_map<disguised_ptr_t, ObjectAssociationMap *, DisguisedPointerHash, DisguisedPointerEqual, AssociationsHashMapAllocator> {
    public:
        void *operator new(size_t n) { return ::malloc(n); }
        void operator delete(void *ptr) { ::free(ptr); }
    };
    
```

`AssociationsHashMap` 是一个map类型，用于保存对象的对象的 `disguised_ptr_t` 到 `ObjectAssociationMap` 的映射


**ObjectAssociationMap源码**

``` C++
class ObjectAssociationMap : public std::map<void *, ObjcAssociation, ObjectPointerLess, ObjectAssociationMapAllocator> {
    public:
        void *operator new(size_t n) { return ::malloc(n); }
        void operator delete(void *ptr) { ::free(ptr); }
    };
```

`ObjectAssociationMap` 则保存了从 key 到关联对象  `ObjcAssociation`      的映射，这个数据结构保存了当前对象对应的所有关联对象

**ObjcAssociation源码**

``` C++
class ObjcAssociation {
        uintptr_t _policy;
        id _value;
    public:
        ObjcAssociation(uintptr_t policy, id value) : _policy(policy), _value(value) {}
        ObjcAssociation() : _policy(0), _value(nil) {}

        uintptr_t policy() const { return _policy; }
        id value() const { return _value; }
        
        bool hasValue() { return _value != nil; }
    };

```

`ObjcAssociation`  就是真正的关联对象的类，上面的所有数据结构只是为了更好的存储它。

最关键的 `ObjcAssociation` 包含了 `policy` 以及 `value`

用一张图解释他们的关系就是：

![](https://user-gold-cdn.xitu.io/2018/3/6/161f8d91dcd23a17?w=3272&h=513&f=png&s=164674)

从上图我们不难看出 `_object_get_associative_reference` 获取关联对象的步骤是：

1. `AssociationsHashMap &associations(manager.associations())` 获取 `AssociationsHashMap` 的单例对象 `associations`
2. `disguised_ptr_t disguised_object = DISGUISE(object)` 获取对象的地址
3. 通过对象的地址在 `associations` 中获取 `AssociationsHashMap`迭代器
4. 通过 `key`获取到 `ObjectAssociationMap`的迭代器
5. 最后得出关联对象类 `ObjcAssociation` 的实例 `entry`，再获取到 `value` 和 `policy` 的值


##### _object_set_associative_reference

``` C++
void _object_set_associative_reference(id object, void *key, id value, uintptr_t policy) {
    // retain the new value (if any) outside the lock.
    uintptr_t old_policy = 0; // NOTE:  old_policy is always assigned to when old_value is non-nil.
    id new_value = value ? acquireValue(value, policy) : nil, old_value = nil; // 调用 acquireValue 对 value 进行 retain 或者 copy
    {

        // & 取地址 *是指针，就是地址的内容
        AssociationsManager manager;  // 初始化一个 AssociationsManager 类型的变量 manager
        AssociationsHashMap &associations(manager.associations());   // 取得一个全局的 AssociationsHashMap 单例
        if (new_value) {

            // 如果new_value不为空，开始遍历associations指向的map，查找object对象是否存在保存联合存储数据的ObjectAssociationMap对象

            // 查找map中是否包含某个关键字条目，用 find() 方法，传入的参数是要查找的key（被关联对象的内存地址），在这里需要提到的是begin()和end()两个成员，分别代表map对象中第一个条目和最后一个条目，这两个数据的类型是iterator.
            // 定义一个条目变量 i (实际是指针)
            AssociationsHashMap::iterator i = associations.find(object);  // AssociationsHashMap 是一个无序的哈希表，维护了从对象地址到 ObjectAssociationMap 的映射；


            // iterator是 C++ 中的迭代器 ， 这句话是定义一个 AssociationsHashMap::iterator 类型的变量 i，初始化为 associations.find(object) ， associations是AssociationsHashMap类型对象。

            // 通过map对象的方法获取的iterator数据类型 是一个std::pair对象
            // 根据对象地址获取起对应的 ObjectAssociationMap对象
            if (i != associations.end()) {
                // 存在

                // object对象在associations指向的map中存在一个ObjectAssociationMap对象refs

                // ObjectAssociationMap 是一个 C++ 中的 map ，维护了从 key（就是外界传入的key） 到 ObjcAssociation 的映射，即关联记录
                ObjectAssociationMap *refs = i->second;              //  指针 调用方法 需要用 ->   i 是 AssociationsHashMap    i->second 表示ObjectAssociationMap  i->first 表示对象的地址
                ObjectAssociationMap::iterator j = refs->find(key);  //  根据传入的关联对象的key（一个地址）获取其对应的关联对象  ObjectAssociationMap


                // 关联对象是否存在
                if (j != refs->end()) {
                    // 使用过该key保存value，用新的value和policy替换掉原来的值
                    // 如果存在 持有旧的关联对象
                    ObjcAssociation &old_entry = j->second;  
                    old_policy = old_entry.policy;
                    old_value = old_entry.value;

                    // 存入新的关联对象
                    old_entry.policy = policy;
                    old_entry.value = new_value;
                } else {
                    // 没用使用过该key保存value，将value和policy保存到key映射的map中
                    // 如果不存在 直接存入新的关联对象
                    (*refs)[key] = ObjcAssociation(policy, new_value);   // 对map 插入元素
                }
            }
            else {

                // 不存在
                // 没有object就创建
                // create the new association (first time).
                ObjectAssociationMap *refs = new ObjectAssociationMap;
                associations[object] = refs;
                (*refs)[key] = ObjcAssociation(policy, new_value);
                _class_setInstancesHaveAssociatedObjects(_object_getClass(object));
            }
        } else {
            // setting the association to nil breaks the association.
            AssociationsHashMap::iterator i = associations.find(object);
            if (i !=  associations.end()) {
                ObjectAssociationMap *refs = i->second;
                ObjectAssociationMap::iterator j = refs->find(key);
                if (j != refs->end()) {
                    ObjcAssociation &old_entry = j->second;
                    old_policy = old_entry.policy;
                    old_value = (id) old_entry.value;

                    // 从 map中删除该项
                    refs->erase(j);
                }
            }
        }
    }

    // 旧的关联对象是否存在，如果存在，释放旧的关联对象。
    // release the old value (outside of the lock).
    if (old_value) releaseValue(old_value, old_policy);
}
```

`_object_set_associative_reference`设置关联对象的流程参照图片：

![](https://user-gold-cdn.xitu.io/2018/3/6/161f93d77f7144de?w=700&h=816&f=jpeg&s=61761)

##### 关联策略

在给一个对象添加关联对象时有五种关联策略可供选择：

| 关联策略        | 等价属性    |  说明  |
| :----  | :----  | :---- |
| OBJC_ASSOCIATION_ASSIGN        | @property (assign) or @property (unsafe_unretained)      |   弱引用关联对象    |
| OBJC_ASSOCIATION_RETAIN_NONATOMIC        | @property (strong, nonatomic)      |  强引用关联对象，且为非原子操作    |
| OBJC_ASSOCIATION_COPY_NONATOMIC        | @property (copy, nonatomic)     |   复制关联对象，且为非原子操作   |
| OBJC_ASSOCIATION_RETAIN        | @property (strong, atomic)      |   强引用关联对象，且为原子操作   |
| OBJC_ASSOCIATION_COPY        | @property (copy, atomic)      |   复制关联对象，且为原子操作    |


##### _object_remove_assocations

``` C++
void _object_remove_assocations(id object) {
    vector< ObjcAssociation,ObjcAllocator<ObjcAssociation> > elements;
    {
        AssociationsManager manager;
        AssociationsHashMap &associations(manager.associations());
        if (associations.size() == 0) return;
        disguised_ptr_t disguised_object = DISGUISE(object);
        AssociationsHashMap::iterator i = associations.find(disguised_object);
        if (i != associations.end()) {
            // 获取到所有的关联对象的associations实例
            ObjectAssociationMap *refs = i->second;
            for (ObjectAssociationMap::iterator j = refs->begin(), end = refs->end(); j != end; ++j) {
                elements.push_back(j->second);
            }
            delete refs;    //删除ObjectAssociationMap
            associations.erase(i);//删除AssociationsHashMap
        }
    }
    //删除elements集合中的所有ObjcAssociation元素
    for_each(elements.begin(), elements.end(), ReleaseValue());
}
```

删除关联对象的流程相对就比较简单了，将获取到的关联对象ObjcAssociation的实例放入一个 `vector`中，删除对应的 `ObjectAssociationMap` 和 `AssociationsHashMap`,最后对 `vector` 中每个 `ObjcAssociation` 实例做release操作

### 总结

Category在iOS开发中是比较常见的，用于给现有的类拓展新的方法和属性。本文从底层分析了Category的原理，以及关联对象实现，使大家对Category能有一个更深的认识，在以后的开发工作中能更好的使用这一特性。