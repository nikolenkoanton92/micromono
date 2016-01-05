var SuperPipe = require('superpipe')


exports.initLocalService = SuperPipe
  .pipeline()
  // Gether service information
  .pipe('getEnvVariables')
  .pipe('getPackageJSON', 'packagePath', 'packageJSON')
  .pipe('getServiceInfo',
    ['packageJSON', 'service'],
    ['hasAsset', 'serviceName', 'serviceInfo', 'serviceVersion'])
  .pipe('prepareService', ['hasAsset', 'service'])
  // Setup web features
  .pipe('prepareFramework?',
    ['framework', 'setDep'],
    ['app', 'attachRoutes', 'attachLocalMiddlewares', 'startHttpServer', 'serveLocalAsset'])
  .pipe('setupAsset?', ['hasAsset', 'packageJSON'], ['asset', 'assetInfo'])
  .pipe('setupRoute?', ['route', 'page', 'pageApiBaseUrl'], 'routes')
  .pipe('setupUse?', 'use', 'uses')
  .pipe('setupMiddleware?', ['middleware', 'middlewareBaseUrl'], 'middlewares')
  // Start web server and attach request handlers
  .pipe('startWebServer?',
    ['port', 'host', 'serviceName', 'startHttpServer', 'setDep'],
    ['httpServer', 'httpPort', 'httpHost'])
  .pipe('serveLocalAsset?', ['asset', 'serviceName'])
  .pipe('attachRoutes?', ['routes', 'service'])
  .pipe('attachLocalMiddlewares?', ['middlewares', 'service'])
  // RPC features
  .pipe('setupRPC?', ['api', 'rpcType'], ['rpc', 'rpcApi'])
  .pipe('startRPCServer?', ['rpc', 'rpcPort', 'host', 'service', 'setDep', 'next'])
  .pipe('generateAnnouncement',
    ['assetInfo', 'routes', 'uses', 'middlewares', 'service',
      'httpPort', 'framework', 'rpcApi', 'rpcPort', 'rpcType', 'host'
    ], 'announcement')
  .pipe('announceService', ['serviceName', 'announcement'])