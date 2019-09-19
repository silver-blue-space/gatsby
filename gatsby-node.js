/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */
const path = require('path');
const { createFilePath } = require('gatsby-source-filesystem');
const store = {
  // 帖子
  posts: [],
  postsMap: {},
  // 标签
  tags: [],
  tagsMap: {},
  // 系列
  series: [],
  seriesMap: {},
  // 作者
  authors: [],
  authorsMap: {},
};
const PAGE_SIZE = 10;

// custom webpack configuration
exports.onCreateWebpackConfig = ({ stage, actions }) => {
  actions.setWebpackConfig({
    resolve: {
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
    },
  });
};

// slug
exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions;

  if (node.internal.type === `MarkdownRemark`) {
    const value = createFilePath({
      node,
      getNode,
      basePath: 'content/posts',
      trailingSlash: false,
    });

    createNodeField({
      name: `slug`,
      node,
      value,
    });
  }
};

// create pages
exports.createPages = ({ page, graphql, actions }) => {
  const { createPage } = actions;
  const dateSorter = `sort: { fields: frontmatter___date, order: DESC }`;
  const draftFilter =
    process.env.NODE_ENV === 'production'
      ? `filter: { frontmatter: { draft: { ne: true } } }`
      : '';

  return new Promise((resolve, reject) => {
    graphql(`
      query allPostsQuery {
        allMarkdownRemark(
          ${draftFilter}
          ${dateSorter}
        ) {
          edges {
            node {
              id
              fields {
                slug
              }
              frontmatter {
                cover {
                  id
                }
                date
                author {
                  id
                  organization
                }
                tags {
                  id
                }
                series {
                  id
                }
              }
            }
          }
        }
      }
    `)
      .then(({ data, errors }) => {
        if (errors) {
          console.error(errors);

          return reject('出错啦');
        }

        const {
          allMarkdownRemark: { edges: rawPosts },
        } = data;

        store.posts = rawPosts.map(({ node }) => node);

        if (store.posts.some(post => !post.frontmatter.cover)) {
          return reject('[POST] 每篇文章必须包含封面（cover）字段');
        }

        if (store.posts.some(post => !post.frontmatter.author)) {
          return reject('[POST] 每篇文章必须包含作者（author）字段');
        }

        store.posts.forEach(post => {
          const {
            id,
            frontmatter: { date, author, tags, series },
          } = post;

          store.postsMap[id] = post;

          // 标签
          if (tags) {
            tags.forEach(tag => {
              const { id } = tag;

              if (!store.tags.some(t => t.id === id)) {
                store.tags.push(tag);
              }

              if (!store.tagsMap[id]) {
                store.tagsMap[id] = [];
              }

              store.tagsMap[id].push(post);
            });
          }

          // 系列
          if (series) {
            const { id } = series;

            if (!store.series.some(x => x.id === id)) {
              store.series.push(series);
            }

            if (!store.seriesMap[id]) {
              store.seriesMap[id] = [];
            }

            store.seriesMap[id].push(post);
          }

          // 作者
          if (author) {
            const { id } = author;

            if (!store.authors.some(x => x.id === id)) {
              store.authors.push(author);
            }

            if (!store.authorsMap[id]) {
              store.authorsMap[id] = [];
            }

            store.authorsMap[id].push(post);
          }
        });

        // tags 排序
        store.tags = store.tags.sort((x, y) => {
          const { tagsMap } = store;
          const xLen = tagsMap[x.id].length;
          const yLen = tagsMap[y.id].length;

          return xLen === yLen ? 0 : xLen < yLen ? 1 : -1;
        });

        // series 排序
        store.series = store.series.sort((x, y) => {
          const { seriesMap } = store;
          const xLen = seriesMap[x.id].length;
          const yLen = seriesMap[y.id].length;

          return xLen === yLen ? 0 : xLen < yLen ? 1 : -1;
        });

        // authors 排序
        store.authors = store.authors.sort((x, y) => {
          const { authorsMap } = store;
          const xLen = authorsMap[x.id].length;
          const yLen = authorsMap[y.id].length;

          return xLen === yLen ? 0 : xLen < yLen ? 1 : -1;
        });

        // 生成帖子相关页面
        createPostPage(createPage);
        // 生成标签相关页面
        createTagPage(createPage);
        // 生成系列相关页面
        createSeriesPage(createPage);
        // 生成作者相关页面
        createAuthorPage(createPage);
        // 生成归档相关页面
        createArchivePage(createPage);

        resolve();
      })
      .catch(reject);
  });
};

function pathResolve(relativePath) {
  return path.resolve(__dirname, relativePath || '');
}

function createPostPage(createPage) {
  const { posts, tags, series, authors } = store;

  // 帖子详情页
  posts.forEach((post, index) => {
    const nextPost = index - 1 < 0 ? null : posts[index - 1];
    const prevPost = index + 1 >= posts.length ? null : posts[index + 1];

    createPage({
      path: post.fields.slug,
      component: pathResolve('src/templates/post/page.js'),
      context: {
        id: post.id,
        prevSlug: (prevPost && prevPost.fields.slug) || '',
        nextSlug: (nextPost && nextPost.fields.slug) || '',
      },
    });
  });

  // 分页
  createPaginationPage(
    {
      data: posts,
      map: {
        // 首页
        0: {
          path: '/',
        },
      },
      prefix: '/list/',
      component: pathResolve('src/templates/index/page.js'),
      context: {
        tags: tags.slice(0, 5).map(x => x.id),
        series: series.slice(0, 5).map(x => x.id),
        authors: authors.slice(0, 5).map(x => x.id),
      },
    },
    createPage
  );
}

function createTagPage(createPage) {
  const { tags, tagsMap } = store;

  tags.forEach(tag => {
    const posts = tagsMap[tag.id];

    // 分页
    createPaginationPage(
      {
        data: posts,
        map: {
          // 标签首页
          0: {
            path: `/tag/${tag.id}`,
          },
        },
        prefix: `/tag/${tag.id}/`,
        component: pathResolve('src/templates/tag/page.js'),
        context: { tag: tag.id },
      },
      createPage
    );
  });
}

function createSeriesPage(createPage) {
  const { series, seriesMap } = store;

  series.forEach(series => {
    const posts = seriesMap[series.id];

    // 分页
    createPaginationPage(
      {
        data: posts,
        map: {
          // 系列首页
          0: {
            path: `/series/${series.id}`,
          },
        },
        prefix: `/series/${series.id}/`,
        component: pathResolve('src/templates/series/page.js'),
        context: { series: series.id },
      },
      createPage
    );
  });
}

function createAuthorPage(createPage) {
  const { authors, authorsMap } = store;

  authors.forEach(author => {
    const posts = authorsMap[author.id];

    // 分页
    createPaginationPage(
      {
        data: posts,
        map: {
          // 作者首页
          0: {
            path: `/author/${author.id}`,
          },
        },
        prefix: `/author/${author.id}/`,
        component: author.organization
          ? pathResolve('src/templates/organization/page.js')
          : pathResolve('src/templates/author/page.js'),
        context: { author: author.id },
      },
      createPage
    );
  });
}

function createArchivePage(createPage) {
  const { posts } = store;

  // 分页
  createPaginationPage(
    {
      data: posts,
      map: {
        // 归档首页
        0: {
          path: `/archive`,
        },
      },
      prefix: `/archive/`,
      component: pathResolve('src/templates/archive/page.js'),
      pageSize: 50,
      context: {},
    },
    createPage
  );
}

function createPaginationPage(options, createPage) {
  const {
    data = [],
    map = {},
    prefix = '/',
    component,
    pageSize = PAGE_SIZE,
    context = {},
  } = options;
  const total = Math.ceil(data.length / pageSize);

  if (total <= 0) return;

  for (let i = 0; i < total; i++) {
    const p = (map[i] && map[i].path) || path.join(prefix, `${i + 1}`);
    const pe = (map[i - 1] && map[i - 1].path) || path.join(prefix, `${i}`);
    const nx = (map[i + 1] && map[i + 1].path) || path.join(prefix, `${i + 2}`);
    const c = (map[i] && map[i].component) || component;

    createPage({
      path: p,
      component: c,
      context: {
        ...context,
        prev: i - 1 >= 0 ? pe : null,
        next: i + 1 < total ? nx : null,
        curr: i,
        total,
        posts: data
          .slice(i * pageSize, Math.max((i + 1) * pageSize, data.length))
          .map(x => x.id),
      },
    });
  }
}
