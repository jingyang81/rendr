/*global rendr*/

var Backbone, BaseRouter, noop, _;

_ = require('underscore');
Backbone = require('backbone');

function noop() {}

module.exports = BaseRouter;

/**
 * Base router class shared betwen ClientRouter and ServerRouter.
 */
function BaseRouter(options) {
  this.route = this.route.bind(this);
  this._routes = [];
  this._initOptions(options);
  this.initialize(options);
}

/**
 * Config
 *   - errorHandler: function to correctly handle error
 *   - paths
 *     - entryPath (required)
 *     - routes (optional)
 *     - controllerDir (optional)
 *   - stashError: optional function to notify server of error
 */
BaseRouter.prototype.options = null;

/**
 * Internally stored route definitions.
 */
BaseRouter.prototype._routes = null;

BaseRouter.prototype.reverseRoutes = false;

BaseRouter.prototype.initialize = function(options) {};

BaseRouter.prototype._initOptions = function(options) {
  var paths;

  this.options = options || {};
  paths = this.options.paths = this.options.paths || {};
  paths.entryPath = paths.entryPath || rendr.entryPath;
  paths.routes = paths.routes || paths.entryPath + '/app/routes';
  paths.controllerDir = paths.controllerDir || paths.entryPath + '/app/controllers';
};

BaseRouter.prototype.getController = function(controllerName) {
  var controllerDir, controller;
  controllerDir = this.options.paths.controllerDir;
  try {
    controller = require(controllerDir + "/" + controllerName + "_controller");
  } catch (e) {
    controller = undefined;
  }
  return controller;
};

/**
 * Given an object with 'controller' and 'action' properties,
 * return the corresponding action function.
 */
BaseRouter.prototype.getAction = function(route) {
  var controller, action;
  controller = this.getController(route.controller);
  if (controller) {
    action = controller[route.action];
  } else {
    action = undefined;
  }
  return action;
};

BaseRouter.prototype.getRedirect = function(route, params) {
  var redirect = route.redirect;
  if (redirect != null) {
    /**
     * Support function and string.
     */
    if (typeof redirect === 'function') {
      redirect = redirect(params);
    }
  }
  return redirect;
};

/**
 * Build route definitions based on the routes file.
 */
BaseRouter.prototype.buildRoutes = function() {
  var routeBuilder, routes, _this = this;

  function captureRoutes() {
    routes.push(_.toArray(arguments));
  }

  routeBuilder = require(this.options.paths.routes);
  routes = [];

  try {
    routeBuilder(captureRoutes);
    if (this.reverseRoutes) {
      routes = routes.reverse();
    }
    routes.forEach(function(route) {
      _this.route.apply(_this, route);
    });
  } catch (e) {
    throw new Error("Error building routes: " + e.message);
  }
  return this.routes();
};

/**
 * Returns a copy of current route definitions.
 */
BaseRouter.prototype.routes = function() {
  return this._routes.slice().map(function(route) {
    return route.slice();
  });
};

/**
 * Method passed to routes file to build up routes definition.
 * Adds a single route definition.
 */
BaseRouter.prototype.route = function(pattern) {
  var action, definitions, handler, route, routeObj;

  definitions = _.toArray(arguments).slice(1);
  route = this.parseDefinitions(definitions);
  action = this.getAction(route);
  if (pattern.slice(0, 1) !== '/') {
    pattern = "/" + pattern;
  }
  handler = this.getHandler(action, pattern, route);
  routeObj = [pattern, route, handler];
  this._routes.push(routeObj);
  this.trigger('route:add', routeObj);
  return routeObj;
};

BaseRouter.prototype.parseDefinitions = function(definitions) {
  var route;

  route = {};
  definitions.forEach(function(element) {
    var parts;

    /**
     * Handle i.e. 'users#show'.
     */
    if (_.isString(element)) {
      parts = element.split('#');
      _.extend(route, {
        controller: parts[0],
        action: parts[1]
      });
    } else {
      /**
       * Handle objects ,i.e. {controller: 'users', action: 'show'}.
       */
      _.extend(route, element);
    }
  });
  return route;
};

/**
 * Support omitting view path; default it to ":controller/:action".
 */
BaseRouter.prototype.defaultHandlerParams = function(viewPath, locals, route) {
  if (typeof viewPath !== 'string') {
    locals = viewPath;
    viewPath = route.controller + '/' + route.action;
  }
  return [viewPath, locals];
};

/**
 * Methods to be extended by subclasses.
 * -------------------------------------
 */

/**
 * This is the method that renders the request.
 */
BaseRouter.prototype.getHandler = noop;

/**
 * Mix in Backbone.Events.
 */
_.extend(BaseRouter.prototype, Backbone.Events);
