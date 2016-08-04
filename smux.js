'use strict';

var ex = require('express'), 
    fs = require('fs'), 
    http = require('http'),
    jsonf = require('jsonfile'),
    parser = require('body-parser'),
    path = require('path'),
    prg = require('path-to-regexp'),
    xml = require('xml');

function smux(options)
{
    if (!options.services && !options.service) return;
    
    class Config
    {
        constructor(path)
        {
            this.apps = {};
            this.path = path;
        }

        refresh(init)
        {
            var ctx = this;
            
            jsonf.readFile(this.path, function(error, config)
            {
                if (error) 
                {
                    if (ctx.name) return Handlers.warning(error);
                    else Handlers.alert(error.message);
                }
                
                ctx.set = config;
                
                for (let i in config.apps)
                {
                    if (init || config.apps[i].refresh) 
                    {
                        config.apps[i].path = config.path;
                        
                        Handlers.app(ctx.service, config.apps[i], init);
                    }
                }
                
                if (init) init.call(ctx.service);
                else
                {
                    plugs.all('refresh');
                    
                    ctx.validate(config.apps);
                }
                
                if (config.refresh)
                {
                    if (config.refresh.every > 0) setTimeout(function()
                    {
                       ctx.refresh.call(ctx);
                        
                    }, config.refresh.every * 1000); 
                }
            });
        }
        
        validate(apps)
        {
            for (let name in this.apps)
            {
                if (apps.find(function(app)
                {
                    return app.name == name;
                    
                })) continue;
                
                let terminate = true;
                
                for (let i in this.apps[name].routes)
                {
                    this.service.terminate(this.apps[name], this.apps[name].routes[i]);
                    
                    if (this.apps[name].routes[i].process)
                    {
                        terminate = false; continue;
                    }
                    
                    this.apps[name].routes[i].action = Handlers.unrecognized;
                }
                
                if (terminate) this.service.terminate(this.apps[name]);
            }
        }
    }
    
    class Format
    {
        constructor(mime, action)
        {
            this.mime = mime;
            this.action = action;
        }
    }
    
    class Handlers
    {
        static alert(message)
        {
            throw '{ "error": "' + message + '" }';
        }
        
        static app(service, config, init)
        {
            config.dir = config.path + '/' + config.name; config.routes = [];
        
            service.config.apps[config.name] = config;
            
            Handlers.code(config.dir + '/' + config.version + '.api', function(api)
            {
                if (!api) return;
                
                for (let route in api)
                {
                    let handler = new Route(route, config, api[route]);
                    
                    handler.process = true;
                    
                    plugs.all('route', [config, handler]);
                    
                    if (handler.process) config.routes.push(handler);
                }
                
                if (!init) plugs.all('refresh', [config]);
            });
        }
        
        static block(request, reason)
        {
            var result = 
            { 
                valid: false,
                error: '`' + request.originalUrl + '` ' + reason
            };
            
            if (request.details) result.details = request.details;
            
            return result;
        }
        
        static code(file, action)
        {
            if (!action) return;
            
            fs.readFile(file, 'utf8', function (error, code) 
            {
                if (error)
                {
                    Handlers.warning(error);
                    
                    return action(undefined);
                }
                
                action(eval('(function(){"use strict";return ' + code + '})();')); 
            });
        }
        
        static file(request, action)
        {
            var file = './' + request.originalUrl;
                
            fs.readFile(file, fs.F_OK, function(error, data) 
            {
                action(file, data, error);
            });
        }    
        
        static invalid(request)
        {
            return Handlers.block(request, 'is invalid');
        }

        static response(service, request, response, config, result, file)
        {
            if (file)
            {
                response.type(path.extname(file));

                response.send(result);
            }
            else
            {
                var format = formats[config.format] || formats['json'];
                
                response.type(format.mime);
                
                if (result.valid !== false) result.valid = true;
                
                result.timestamp = new Date().getTime();
                
                format.action.call(service, request, response, result);
            }
            
            plugs.all('response', [config, request, response, file || result, file ? true : false]);
        }
        
        static unrecognized(request)
        {
            return Handlers.block(request, 'is not recognized');
        }
        
        static warning(info)
        {
            plugs.all('warning', [info]);
        }
    }
    
    class Plug
    {
        constructor(file, dependencies, ready)
        {
            var ctx = this;
            
            Handlers.code(file, function(plug)
            {
                ctx.dependencies = {};
                ctx.handler = plug; 
                ctx.name = path.basename(file).split('.')[0];
                
                for (var i in dependencies)
                {
                    ctx.dependencies[dependencies[i].name] = dependencies[i];
                }
                
                ready();
            });
        }
        
        exec(listener, args)
        {
            if (this.handler[listener] && typeof this.handler[listener] == 'function')
            {
                return this.handler[listener].apply(this.instance || {}, args || []);
            }
        }
    }
    
    class Plugs
    {
        constructor(plugs, ready)
        {
            if (!plugs) 
            {
                this.terminate(); 
                
                return ready();
            }
            
            var count = 0, ctx = this;
            
            this.handlers = [];

            for (let i in plugs)
            {
                this.handlers.push(new Plug(plugs[i], this.handlers.slice(), function()
                {
                    if (++count == plugs.length) ready();
                }));
            }
        }
        
        all(listener, args, init)
        {
            if (this.terminated && listener != 'terminated') return;
            
            for (let i in this.handlers)
            {
                let plug = this.handlers[i]; 
                
                let params = args ? args.slice(): []; if (init) params.push(plug.dependencies);
                
                try
                {
                    let instance = plug.exec(listener, params);

                    if (instance) plug.instance = instance;
                }
                catch(ex) { plug.exec('error', [ex]); }
            }
        }
        
        terminate()
        {
            this.terminated = true;
        }
    }
    
    class Route
    {
        constructor(value, config, action)
        {
            var index = value.indexOf('/');
        
            this.keys = [];
            
            this.method = index < 1 ? 'GET' : value.substr(0, index).toUpperCase();
            this.path = '/' + (this.name = config.name) + (index < 0 ? '' : value.substr(index, value.length - index));
            this.regex = prg(this.path, this.keys);
            this.action = action;
        }
        
        static exec(ctx, app, request, response)
        {
            var on = 'compute', routes = Route.match(request, app); 
            
            var route = routes.find(function(route) 
            { 
                return route.path == request.originalUrl; 
            });
                 
            if (route) plugs.all(on, [app, request, response]);
            else
            {
                let args; 
                
                route = routes.find(function(route) 
                { 
                    return (args = route.regex.exec(request.originalUrl)) !== null; 
                });
                
                if (route) 
                {
                    request.params = route.params(args);
                    
                    plugs.all(on, [app, request, response, request.params]);
                }
            }
            
            if (route)
            {
                //if (request.process) Handlers.response(ctx, request, response, app, route.action(using, request, response));
                
                if (request.process) route.action(using, request, response, function (data)
                {
                    Handlers.response(ctx, request, response, app, data);
                });
                
                else if (response.result) response.send(response.result);
                
                else Handlers.response(ctx, request, response, app, Handlers.invalid(request));
                
                return true;
            }
        }
        
        static match(request, app)
        {
            return app.routes.filter(function(route)
            {
                return route.name == app.name && route.method == request.method;
            });
        }
        
        params(args)
        {
            var params = {};
            
            for (let i in this.keys)
            {
                params[this.keys[i].name] = args[(i | 0) + 1];
            }

            return params;
        }
    }
    
    class Service
    {
        constructor(config)
        {
            this.config = config;

            this.config.service = this;

            this.config.refresh(this.init);
        }
        
        init()
        {
            this.validate('name'); this.validate('port');
            
            var ctx = this, service = ex();
            
            plugs.all('init', [this.config.set], true);
            
            service.use(parser.urlencoded({ extended: true }));
            service.use(parser.json());
            service.disable('etag');
            service.use(function(request, response)
            {
                request.process = true;
                
                plugs.all('request', [ctx.config.set, request, response]);
                
                if (request.process)
                {
                    for (let i in ctx.config.apps)
                    {
                        if (Route.exec(ctx, ctx.config.apps[i], request, response)) return;
                    }
                    
                    plugs.all('file', [ctx.config.set, request, response]);
                    
                    if (request.process) Handlers.file(request, function(file, data, error)
                    {
                        Handlers.response(ctx, request, response, ctx.config.set, (error) ? Handlers.unrecognized(request) : data, (error) ? undefined : file);
                    })
                    else if (response.result) response.send(response.result);
                }
                
                if (!request.process) 
                {
                    if (response.result) response.send(response.result);
                    else Handlers.response(ctx, request, response, ctx.config.set, Handlers.invalid(request));
                }
            });

            http.createServer(service).listen(this.config.set.port);
            
            this.notify('load'); 
        }
        
        notify(on)
        {
            for (let name in this.config.apps)
            {
                plugs.all(on, [this.config.apps[name]]);
            }
            
            plugs.all(on);
        }
        
        terminate(app, route)
        {
            if (app) plugs.all('unroute', [app, route]);
            else 
            {
                this.notify('unload');
                
                plugs.terminate();
            }
        }
        
        validate(prop)
        {
            if (!this.config.set[prop]) Handlers.alert('configuration must inclue a valid `' + prop + '` property');
        }
    }
    
    class Services
    {
        constructor(services)
        {
            function terminate()
            {
                var interval = 1718;
                
                for (let i in ctx.handlers)
                {
                    ctx.handlers[i].terminate();
                }
                
                setTimeout(function()
                {
                    plugs.all('terminated');
                    
                    setTimeout(process.exit, interval);
                    
                }, interval);
            }
            
            var ctx = this; this.handlers = [];
            
            for (let i in services)
            {
                this.handlers.push(new Service(new Config(services[i])));
            }

            process.on('SIGTERM', terminate);
            process.on('SIGINT', terminate);
        }
    }
    
    class Using
    {
        constructor(using)
        {
            this.handlers = {};
            
            for (let i in using)
            {
                this.handlers[using[0][i].replace(/-/g,'_')] = require(this.handlers[0][i]);
            }
        }
        
        set()
        {
           return this.handlers; 
        }
    }

    var formats = 
    {
        json: new Format('json', function(request, response, result) 
        { 
            response.json(result); 
        }),
        jsonp: new Format('javascript', function(request, response, result) 
        { 
            response.send((request.query.callback ? request.query.callback : '?') + '(' + JSON.stringify(result) + ');'); 
        }),
        xml: new Format('xml', function(request, response, result)
        { 
            response.send(xml(result, { declaration: true })); 
        })
        
    };
    
    var using = options.using ? new Using(options.using).set() : {},
    
        plugs = new Plugs(options.plugs, function()
        {
            new Services(options.services || [options.service]);
        });
}

module.exports = smux;