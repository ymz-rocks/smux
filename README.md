![project-poster][poster]

[poster]:https://raw.githubusercontent.com/ymz-rocks/emblems/master/smux/logo.png "smux project"

# smux (node.js services multiplexer)

Ever wondered what would it be like if your web service could do more then just... serve?
With __smux__ your service can do WAY more stuff with extreme ease.

### Highlights

* Every service is separated logically to applications
* A single app can control as many methods as needed
* One service can host numerous apps for the same purpose
* No need to restart your service on updates... smux comes with a built-in __configurable refresh mechanism__
* With smux you can use and create plug-ins quickly and easily (less then 5 minutes from zero to your first plug-in)
* Complex configurations / copy-n-paste code injections - OUT!
* A ready to use sample to make you up and running as soon as possible

### List of official plugins

* Cache - select which app will use a cache and configure:
    1. cache intervals
    2. clear intervals - remove cached items and prevent high memory usage
    3. headers - which headers will be saved along with each response

* Log - an automatic log for the entire service which let you enable or disable:
    1. file system logging
    2. console logging
    
### Quick start

1. Download this repository
2. Copy the _simple service_ folder in a suitable location (this folder would be your working folder)
3. Open _service.config_ file and validate the configuration (for instance: make sure port number is not already taken)
4. Make sure that you have node installed properly on your machine
5. Open the terminal (or command prompt if you use windows) and navigate to the working folder location
6. Type __node service.js__
7. Your first service is up and running!
8. Open your browser and insert the following url: __http://localhost:7008/test1__
9. Browse the 3 test apps and navigate between apps and end-points
10. Stop the service by hitting __Ctrl+C__ over the service terminal window

### Basic configuration

With smux, each node module can represent a server.
When you start a fresh module, please make sure that the followings are configured inside your __package.json__ file

    {
        "name": "name of your module",
        "version": "1.0.0",
        "description": "describe your server here",
        
        "dependencies": 
        {
            "smux": "^1.0.0"
        }
    }

That configuration will setup the enviroment required for smux to full operate. More settings and dependencies are welcomed.

For each service - please define the following files:

1. Code file (.js) of the service (required)

2. Config file, which determine the current settings of the service (required)

3. File for each plugin to achive extended functionality (optional)

You may try those settings:

1. Code file

        require('smux')({ service: './service.config' });
        
2. Config file

        {
            // service domain name or sub-domain name or ip address
            "name": "localhost",    
            
            // path for the service applications dir
            "path":"./apps",                
            
            // service port
            "port": 7008,           

            // [optional] determines the apps refresh rate (in seconds)
            "refresh":              
            {
                "every": 10        
            },
            
            // apps configuration section
            "apps":                     
            [
                {
                    "name": "demo",    // name of app dir
                    "version": "1.0",   // name of api file without extension
                    "format":"json",    // app format (json / jsonp / xml)
                    "refresh": "true"   // true if this app supports refresh
                },
                
                {
                    "name": "another demo",
                    ...   
                },
                
                ...
            ]
        }
        
3. Code file (with pulgins)

        require('smux')
        ({
            
            service: './service.config',
            
            // make sure your module contains plugs dir with the following files
            // if a plug is dependent on another one - put it below and keep order correct
            plugs:
            [
                './plugs/smux-log.1.0.plug',
                './plugs/smux-cache.1.0.plug' // this plug is using the log plug
            ]
        
        });
        
### Working with plugins

When dealing with plugins, you may preffer use exisitng work or extend your service yourself. If you intend to build your first plugin, please reffer to the __smux_plug_template.plug__ to get a general concept about how to fill your code in. If you wish to use the official smux plugins, please read the instructions below.

NOTE: Please try to keep your plugins as small and focused as possible in a single file. Also, configuration of each plugin, may be embedded inside the service config file (using the __service__ object inside the __init__ event).
      
### Cache plugin configuration

The cache plugin enable caching for every app individually. With this plug, you make another step forward to a RESTful service. Every cache entry automatically stores the response for each request. Whenever a similar request is made by the time the cache is still active, the service will return a cached response.

NOTE: every response may define a __gen__ property which return the __request.gen__ value that indicates if the request was generated. Therefore, such response will indicate active caching _only_ when the __request.gen__ is __false__.

The configuration should be placed inside every app that required caching, such as follows:

    // apps configuration section
    "apps":                     
     [
        {
            name: "demo",
            ....
            
            // 'demo' app cache section (time measured in seconds)
            "cache":            
            {
                // how much time a cacheable item remains active in cache
                "ttl": 5,     
                
                // how much time until a routine will remove unactive items
                "clear": 10,    
                
                // which response headers should be cahced
                "heads":        
                [
                    "Content-Type"
                ]
            }
        }
     ]
            
### Log plugin configuration

The log plugin provides a basic binary log. Each line of log contains:
* A timestamp
* Full service name (including port number)
* Action ( init / start / echo / get/ post / refresh / stop / exit)
* Request url 
* Response body 

The log itself may be printed to terminal / saved to your server local file system.

NOTE: the configuration of this plugin is defined at the service level (not application)

    // service log section
    "log":
    {
        "console": true,    // output to terminal (otherwise false)
        "fs": true          // save on file system (otherwise false)
    }     
        
### Points of interest

Still not certain? Maybe these points will help:

* As developers, we are used to configure our web server, when every service has its own port number and domain (or sub domain). __But__ unlike domain names, a port is a crucial and delicate resource. Try, for instance, to get a VPS and open a large amount of ports. Most providers will shut down your machine (Plus, this is not the best practice anyway). Unfortunately, services that handle multiple tasks are usually become very messy in no-time. With smux, you can make logical separation that will make your service clean (no more mess) and clear (every app is responsible for a specific role)

* Remember that time you put your hands on a new lib / module / framework that seems really easy to establish on first sight? Sure, the demo + simple cases scenarios worked as expected... Until real-life scenarios made you realize that your 'easy' solution is, in-fact, completely twisted and wrong for your extreme demands. Well, I've been there myself for couple of times... The frustration... And the translation from one solution to other... What a waste of time! smux is built over node express and it is ready to extreme, so you are granted to download, configure and put it under pressure from the very beginning

*  In many cases, stopping a service for updates / maintenance and restart it over again - may be a risky move, particularly over production servers.
With smux, you are enabled to configure a fixed refresh rate in which the service will update itself WITHOUT the need to restart it against node.
This way, you can put several apps in a single service that shares the same refresh rate (in most cases, apps for a single-solution will share the same refresh rate to keep themselves sync).

*  A single node module may contain several services - each service with a different configuration, bringing you the flexibility you deserve. 
Because each service is responsible for several applications, you can also share the same settings among apps when needed.



    

