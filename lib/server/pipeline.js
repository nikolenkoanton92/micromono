var superpipe = require('superpipe')

exports.initBalancer = superpipe()
  .pipe('getServerOptions',
    'options',
    ['port', 'host', 'serviceNames', 'serviceDir'])
  .pipe('prepareFrameworkForBalancer', ['mainFramework', 'mainApp'], ['attachHttpServer', 'serveBalancerAsset'])
  .pipe('createHttpServer', ['set'], ['httpServer', 'setHttpRequestHandler'])
  .pipe('requireAllServices',
    ['serviceNames', 'serviceDir', 'require'],
    'services')
  .pipe('runServices', ['createPipeline', 'services', 'runService', 'next'])
  .pipe('configBalancerAsset', 'next')
  .pipe('serveBalancerAsset', 'balancerAsset')
  .pipe('attachHttpServer', ['httpServer', 'setHttpRequestHandler'])
  .pipe('startServer', ['httpServer', 'port', 'host', 'setDep'], ['httpPort', 'httpHost'])
