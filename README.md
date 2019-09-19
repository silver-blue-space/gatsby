# gatsby-blog-medium

> 基于 Gatsby 实现的，神似 Medium 的简单个人或团队博客网站

## 预览

[个人博客](https://lizhi1026.cc)

## 导航

- [安装](#安装)
- [内容配置](#内容配置)
  - [添加作者](#添加作者)
  - [添加标签](#添加标签)
  - [添加系列](#添加系列)
  - [添加文章](#添加文章)
- [站点配置](#站点配置)
  - [基本配置](#添加作者)
  - [Google Analytics](#google-analytics)
  - [Disqus](#disqus)
  - [Algolia](#algolia)

## 安装

```bash

yarn install

yarn serve
```

## 内容配置

### 添加作者

> 作者是一片文章的所有者，可以是人，也可以是机构，性质都是作者（暂无区分）。

请在项目根目录的 `content/data/author` 中添加作者。

每个作者可添加单独的 `json` 文件，例如：

```json5
{
  // 必填，在文章的头部通过author引入作者
  id: 'westwood',
  // 必填
  name: 'Li Zhi',
  // 必填
  email: 'lizhi1026@126.com',
  // 必填
  nickname: 'westwood',
  // 必填
  avatar: 'avatar/westwood.png',
  // 必填
  slogan: '求知若饥，虚心若愚 (Stay hungry, stay foolish)',
  // 可选
  links: [
    {
      icon: 'github',
      url: 'https://github.com/gaojihao',
    },
  ],
}
```

### 添加标签

> 标签是一片文章的核心点，内容倾向等。可以通过标签对文章进行归类。这种归类的一系列文章，前后一般是没有任何关系的。

请在项目根目录的 `content/data/tag` 中添加标签。

每个作者可添加单独的 `json` 文件，例如：

```json5
{
  // 必填，在文章的头部通过tags引入标签
  id: 'vue',
  // 必填
  name: 'Vue',
  // 必填
  description: '渐进式 JavaScript 框架',
  // 必填
  cover: 'cover/vue-logo.jpg',
  // 可选
  links: [
    {
      icon: 'github',
      url: 'https://github.com/vuejs/vue',
    },
  ],
}
```

### 添加系列

> 系列是一堆有承接关系的文章的合集。比如《从零开始开发帖子编辑器》，可能分为 8 篇文章，这 8 篇文章归为同一系列。

请在项目根目录的 `content/data/series` 中添加系列。

每个作者可添加单独的 `json` 文件，例如：

```json5
{
  // 必填，在文章的头部通过series引入标签
  id: 'annual-summary',
  // 必填
  name: '年度总结',
  // 必填
  description: '每年一度总结————回顾过去，展望未来！',
  // 必填
  cover: advanced-frontend.png,
}
```

### 添加文章

请在项目根目录的 `content/posts` 中添加文章。

每篇文章的头部有一下属性：

```yaml
#必须填写
title: 标题名称
#必须填写
cover: 封面路径
#必须填写
author: westwood
#必须填写
date: 2018-3-1
#可选
tags: [vue]
#可选
series: annual-summary
```

## 站点配置

### 基本配置

大多数配置只需要改动 `gatsby-config.js` 文件即可。
