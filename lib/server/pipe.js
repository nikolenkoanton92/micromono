var ip = require('ip')
var http = require('http')
var debug = require('debug')('micromono:server:pipe')
var argsNames = require('js-args-names')
var ServicePipeline = require('../service/pipeline')

exports.getServerOptions = function(options) {
  var serviceNames
  if ('string' === typeof options.service) {
    serviceNames = options.service.split(',')
    if (0 === serviceNames.length) {
      serviceNames = undefined
    }
  }
  return {
    port: options.port || process.env.PORT || 3000,
    host: options.host || process.env.HOST || ip.address() || '0.0.0.0',
    serviceNames: serviceNames,
    serviceDir: options.serviceDir || null
  }
}

exports.requireAllServices = function(serviceNames, serviceDir, require) {
  debug('require all services: ', serviceNames)

  var services = {}
  serviceNames.forEach(function(name) {
    services[name] = require(name, serviceDir)
  })

  return {
    services: services
  }
}

exports.initFramework = function(frameworkType, framework) {
  if (!framework && 'string' === typeof frameworkType) {
    debug('initialize framework adapter for "%s"', frameworkType)
    var FrameworkAdapter = require('../web/framework/' + frameworkType)
    framework = new FrameworkAdapter()
  }

  return {
    framework: framework
  }
}

exports.prepareFrameworkForBalancer = function(framework, app) {
  framework.app = app
  return {
    serveBalancerAsset: function(asset) {
      framework.serveLocalAsset(asset, 'balancer')
    },
    attachHttpServer: framework.attachHttpServer.bind(framework)
  }
}

exports.createHttpServer = function(set) {
  var requestHandler

  function setHttpRequestHandler(fn) {
    requestHandler = fn
  }

  function serverHandler(req, res) {
    requestHandler(req, res)
  }

  var httpServer = http.createServer(serverHandler)
  // Set to global superpipe so the children pipelines can use it.
  set('httpServer', httpServer)

  return {
    httpServer: httpServer,
    setHttpRequestHandler: setHttpRequestHandler
  }
}

exports.runServices = function(createPipeline, services, runService, next) {
  var pipeline = createPipeline()
  pipeline.pipe(function setCreatePipeline() {
    return {
      createPipeline: createPipeline
    }
  })

  Object.keys(services).forEach(function(serviceName) {
    var service = services[serviceName]
    var serviceDepName = 'service:' + serviceName
    pipeline.pipe(function setServiceDepName(setDep) {
      setDep(serviceDepName, service)
    }, 'setDep')
    pipeline.pipe(runService, [serviceDepName, 'createPipeline', 'next'])
  })

  pipeline.error('errorHandler')
  pipeline.pipe(next)()
}

exports.runService = function(service, createPipeline, next) {
  debug('[%s] runService()', service.name)
  var pipeline = createPipeline()

  if (service.isRemote) {
    pipeline.pipe(function prepareRemotePipeline(setDep, mainFramework) {
      setDep('service', service)
      setDep('framework', mainFramework)
      setDep('announcement', service.announcement)
    }, ['setDep', 'mainFramework'], ['service', 'announcement', 'framework'])

    pipeline = pipeline.concat(ServicePipeline.initRemoteService)
  } else {
    pipeline = pipeline
      .pipe(function setService(setDep) {
        setDep('service', service)
        setDep('packagePath', service.packagePath)
      }, 'setDep')
      .concat(ServicePipeline.initLocalService)

    if (service.init) {
      var initArgs = argsNames(service.init)
      // Add service.init to pipeline
      pipeline.pipe(service.init, initArgs)
    }

    pipeline = pipeline
      .concat(ServicePipeline.runLocalService)
      .pipe('attachToMainFramework?', ['mainFramework', 'framework'])
      .pipe('generateAnnouncement',
        ['assetInfo', 'routes', 'uses', 'middlewares',
          'service', 'httpPort', 'framework', 'rpcApi',
          'rpcPort', 'rpcType', 'host', 'rpcHost'
        ], 'announcement')
  }

  pipeline
    .pipe(next)
    .error('errorHandler')

  pipeline()
}

exports.attachToMainFramework = function(mainFramework, framework) {
  if (mainFramework !== framework) {
    mainFramework.app.use(framework.app)
  }
}

exports.startServer = function(httpServer, port, host, setDep) {
  debug('start http server')
  httpServer.listen(port, host, function() {
    var address = httpServer.address()

    debug('http server started at %s:%s', address.address, address.port)

    setDep({
      httpPort: address.port,
      httpHost: address.address
    })
  })
}
