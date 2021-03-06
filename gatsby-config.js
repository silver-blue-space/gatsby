require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
});

module.exports = {
  pathPrefix: '/',
  siteMetadata: {
    title: 'westwood',
    description: "westwood's personal website",
    keywords: "westwood,blog,westwood's blog,",
    website: 'https://lizhi1026.cc',
    siteUrl: 'https://lizhi1026.cc',
    nickname: 'westwood',
    slogan: '求知若饥，虚心若愚 (Stay hungry, stay foolish)',
    email: 'lizhi1026@126.com',
    footer: {
      links: [
        {
          name: 'CHANNELS',
          list: [
            {
              name: 'Github',
              link: 'https://github.com/gaojihao',
              tag: 'hot',
            },
            {
              name: 'Email',
              link: 'mailto:lizhi1026@126.com',
            },
          ],
        },
        {
          name: 'PROJECTS',
          list: [
            {
              name: 'LZNetworkHelper',
              link: 'https://github.com/gaojihao/LZNetworkHelper',
            },
            {
              name: 'react-admin',
              link: 'https://github.com/gaojihao/react-admin',
            },{
              name: 'Template-based-code-generation',
              link: 'https://github.com/gaojihao/Template-based-code-generation',
            },
          ],
        },
      ],
    },
  },
  plugins: [
    // https://www.npmjs.com/package/gatsby-source-filesystem
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `data`,
        path: `${__dirname}/content/data`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `posts`,
        path: `${__dirname}/content/posts`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/images`,
      },
    },

    // https://www.npmjs.com/package/gatsby-transformer-json
    'gatsby-transformer-json',

    // https://www.npmjs.com/package/gatsby-transformer-remark
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        excerpt_separator: `<!-- end -->`,
        plugins: [
          'gatsby-remark-abbr',
          'gatsby-remark-autolink-headers',
          'gatsby-remark-copy-linked-files',
          {
            resolve: `gatsby-remark-embed-gist`,
            options: {
              username: 'westwood',
              includeDefaultCss: true,
            },
          },
          'gatsby-remark-emoji',
          'gatsby-remark-external-links',
          {
            resolve: `gatsby-remark-images`,
            options: {
              maxWidth: 1200,
              showCaptions: true,
              linkImagesToOriginal: false,
              backgroundColor: 'transparent',
            },
          },
          'gatsby-remark-katex',
          {
            resolve: `gatsby-remark-mermaid`,
            options: {
              theme: 'neutral',
            },
          },
          {
            resolve: `gatsby-remark-prismjs`,
            options: {
              classPrefix: 'language-',
              noInlineHighlight: false,
            },
          },
          {
            resolve: `gatsby-remark-responsive-iframe`,
            options: {
              wrapperStyle: `margin: 2em -30px`,
            },
          },
          'gatsby-remark-sub-sup',
        ],
      },
    },

    // https://www.npmjs.com/package/gatsby-transformer-sharp
    'gatsby-transformer-sharp',
    // https://www.npmjs.com/package/gatsby-plugin-sharp
    'gatsby-plugin-sharp',

    // http://lesscss.org/
    'gatsby-plugin-less',

    // https://www.npmjs.com/package/gatsby-plugin-remove-trailing-slashes
    'gatsby-plugin-remove-trailing-slashes',

    // https://www.npmjs.com/package/gatsby-plugin-manifest
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: 'gatsby-starter-default',
        short_name: 'starter',
        start_url: '/',
        background_color: '#03a87c',
        theme_color: '#03a87c',
        display: 'minimal-ui',
        icon: 'src/images/avatar.png',
      },
    },

    // https://gatsby.app/offline
    'gatsby-plugin-offline',

    // https://www.npmjs.com/package/gatsby-plugin-feed
    'gatsby-plugin-feed',

    // https://www.npmjs.com/package/gatsby-plugin-google-analytics
    {
      resolve: `gatsby-plugin-google-analytics`,
      options: {
        trackingId: process.env.GATSBY_GOOGLE_ANALYTICS_TRACKINGID,
        // Setting this parameter is optional
        anonymize: true,
      },
    },
  ],
  mapping: {
    'MarkdownRemark.frontmatter.author': `AuthorJson`,
    'MarkdownRemark.frontmatter.series': `SeriesJson`,
    'MarkdownRemark.frontmatter.tags': `TagJson`,
  },
};
