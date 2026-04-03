  function normalizeRuntimeModuleId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getConfiguredRuntimeModules() {
    return Array.isArray(cfg.runtimeModules) ? cfg.runtimeModules : [];
  }

  function getRuntimeModuleRecord(id) {
    if (!state.runtimeModuleRegistry) {
      state.runtimeModuleRegistry = Object.create(null);
    }
    return state.runtimeModuleRegistry[id] || null;
  }

  function runtimeModuleStorageKey(record, suffix) {
    return "ModUiExtractor.lua.runtime-module." + record.id + "." + String(suffix || "state");
  }

  function createRuntimeModuleContext(record) {
    var cleanupFns = [];

    function addCleanup(fn) {
      if (typeof fn === "function") {
        cleanupFns.push(fn);
      }
      return fn;
    }

    function safeRemoveNode(node) {
      try {
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreNodeRemove) {}
    }

    function safeClearTimer(handle, clearFn) {
      try {
        clearFn(handle);
      } catch (_ignoreTimerClear) {}
    }

    var ctx = {
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      config: record.config || {},
      window: window,
      document: document,
      probeState: state,
      probeConfig: cfg,
      sendPacket: function (type, data) {
        var payload = data && typeof data === "object" ? data : {};
        payload.moduleId = record.id;
        sendPacket(type, payload);
      },
      log: function () {
        var args = ["[runtime-module:" + record.id + "]"];
        for (var i = 0; i < arguments.length; i += 1) {
          args.push(arguments[i]);
        }
        safeLog.apply(null, args);
      },
      cleanup: addCleanup,
      trackNode: function (node) {
        if (!node) {
          return node;
        }
        addCleanup(function () {
          safeRemoveNode(node);
        });
        return node;
      },
      addStyle: function (cssText, idSuffix) {
        var style = document.createElement("style");
        style.type = "text/css";
        style.setAttribute("data-lua-runtime-module", record.id);
        if (idSuffix) {
          style.id = "ModUiExtractor-runtime-module-" + record.id + "-" + idSuffix;
        }
        style.textContent = String(cssText || "");
        (document.head || document.documentElement || document.body).appendChild(style);
        return ctx.trackNode(style);
      },
      on: function (target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== "function" || typeof handler !== "function") {
          return handler;
        }
        target.addEventListener(eventName, handler, options || false);
        addCleanup(function () {
          try {
            target.removeEventListener(eventName, handler, options || false);
          } catch (_ignoreRemoveListener) {}
        });
        return handler;
      },
      setInterval: function (fn, ms) {
        var handle = window.setInterval(fn, ms);
        addCleanup(function () {
          safeClearTimer(handle, window.clearInterval);
        });
        return handle;
      },
      setTimeout: function (fn, ms) {
        var handle = window.setTimeout(fn, ms);
        addCleanup(function () {
          safeClearTimer(handle, window.clearTimeout);
        });
        return handle;
      },
      getState: function (key, fallbackValue) {
        if (typeof key === "undefined" || key === null || key === "") {
          return cloneJsonValue(record.state || {}, {});
        }
        if (record.state && Object.prototype.hasOwnProperty.call(record.state, key)) {
          return cloneJsonValue(record.state[key], fallbackValue);
        }
        return typeof fallbackValue === "undefined" ? null : fallbackValue;
      },
      setState: function (key, value) {
        if (!key) {
          return false;
        }
        if (!record.state || typeof record.state !== "object") {
          record.state = {};
        }
        record.state[key] = cloneJsonValue(value, value);
        ctx.sendPacket("lua_runtime_module_state_set", {
          key: String(key),
          value: cloneJsonValue(record.state[key], record.state[key])
        });
        return true;
      },
      replaceState: function (nextState) {
        record.state = nextState && typeof nextState === "object" ? cloneJsonValue(nextState, {}) : {};
        ctx.sendPacket("lua_runtime_module_state_set", {
          state: cloneJsonValue(record.state, {}),
          replace: true
        });
        return true;
      },
      getStoredValue: function (key, fallbackValue) {
        return ctx.getState(key, fallbackValue);
      },
      setStoredValue: function (key, value) {
        return ctx.setState(key, value);
      }
    };

    ctx.runCleanup = function () {
      for (var i = cleanupFns.length - 1; i >= 0; i -= 1) {
        try {
          cleanupFns[i]();
        } catch (_ignoreCleanup) {}
      }
      cleanupFns = [];
    };

    return ctx;
  }

  function compileRuntimeModule(record) {
    var source = String(record && record.source ? record.source : "").trim();
    if (!source) {
      throw new Error("runtime module has no source");
    }

    var factory = (0, eval)("(" + source + "\n)");
    if (typeof factory !== "function") {
      throw new Error("runtime module source must evaluate to a function");
    }
    return factory;
  }

  function syncRuntimeModuleCheckbox(record) {
    var checkbox = document.getElementById("ModUiExtractor-runtime-module-checkbox-" + record.id);
    if (!checkbox) {
      return;
    }
    checkbox.checked = !!record.enabled;
    checkbox.disabled = !!record.busy;
  }

  function syncRuntimeModuleRow(record) {
    var row = document.getElementById("ModUiExtractor-runtime-module-row-" + record.id);
    if (!row) {
      return;
    }

    row.setAttribute("data-enabled", record.enabled ? "1" : "0");
    row.setAttribute("data-active", record.active ? "1" : "0");
    row.setAttribute("data-error", record.lastError ? "1" : "0");

    var errorNode = row.querySelector(".ModUiExtractor-runtime-module-error");
    if (errorNode) {
      errorNode.textContent = record.lastError || "";
      errorNode.style.display = record.lastError ? "block" : "none";
    }

    syncRuntimeModuleCheckbox(record);
  }

  function syncRuntimeModuleMenuUi() {
    var button = document.getElementById("ModUiExtractor-runtime-module-button");
    var panel = document.getElementById("ModUiExtractor-runtime-module-panel");
    if (button) {
      button.setAttribute("aria-expanded", state.runtimeModuleMenuOpen ? "true" : "false");
    }
    if (panel) {
      panel.style.display = state.runtimeModuleMenuOpen ? "block" : "none";
    }

    if (!state.runtimeModuleIds) {
      return;
    }

    for (var i = 0; i < state.runtimeModuleIds.length; i += 1) {
      var record = getRuntimeModuleRecord(state.runtimeModuleIds[i]);
      if (record) {
        syncRuntimeModuleRow(record);
      }
    }
  }

  function getRuntimeModuleMenuIds() {
    var ids = Array.isArray(state.runtimeModuleIds) ? state.runtimeModuleIds.slice() : [];
    if (ids.length <= 1) {
      return ids;
    }
    var visibleIds = [];
    for (var i = 0; i < ids.length; i += 1) {
      if (ids[i] !== "example-module") {
        visibleIds.push(ids[i]);
      }
    }
    return visibleIds.length > 0 ? visibleIds : ids;
  }

  function removeRuntimeModuleMenu() {
    var ids = [
      "ModUiExtractor-runtime-module-style",
      "ModUiExtractor-runtime-module-button",
      "ModUiExtractor-runtime-module-panel"
    ];
    for (var i = 0; i < ids.length; i += 1) {
      try {
        var node = document.getElementById(ids[i]);
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreRemoveRuntimeUi) {}
    }
  }

  function disableRuntimeModule(record, reason) {
    if (!record) {
      return true;
    }

    record.busy = true;
    try {
      if (record.api && typeof record.api.uninstall === "function") {
        record.api.uninstall(reason || "disable");
      }
    } catch (err) {
      record.lastError = String(err && err.message ? err.message : err);
    }

    try {
      if (record.ctx && typeof record.ctx.runCleanup === "function") {
        record.ctx.runCleanup();
      }
    } catch (_ignoreModuleCleanup) {}

    record.api = null;
    record.ctx = null;
    record.active = false;
    record.busy = false;
    syncRuntimeModuleRow(record);
    return !record.lastError;
  }

  function enableRuntimeModule(record, reason) {
    if (!record) {
      return false;
    }
    if (record.active) {
      syncRuntimeModuleRow(record);
      return true;
    }

    record.busy = true;
    record.lastError = "";
    try {
      var factory = record.factory || compileRuntimeModule(record);
      record.factory = factory;
      var ctx = createRuntimeModuleContext(record);
      var api = factory(ctx) || {};
      record.ctx = ctx;
      record.api = api;
      if (typeof api.install === "function") {
        api.install(reason || "enable");
      }
      record.active = true;
      record.busy = false;
      syncRuntimeModuleRow(record);
      return true;
    } catch (err) {
      record.lastError = String(err && err.message ? err.message : err);
      try {
        if (record.ctx && typeof record.ctx.runCleanup === "function") {
          record.ctx.runCleanup();
        }
      } catch (_ignoreFailedCleanup) {}
      record.ctx = null;
      record.api = null;
      record.active = false;
      record.busy = false;
      syncRuntimeModuleRow(record);
      sendPacket("lua_runtime_module_error", {
        moduleId: record.id,
        message: record.lastError,
        during: reason || "enable"
      });
      return false;
    }
  }

  function resolveRuntimeModuleCloseUiHook(record) {
    if (!record || !record.api || typeof record.api !== "object") {
      return null;
    }
    if (typeof record.api.closeUi === "function") {
      return record.api.closeUi;
    }
    if (typeof record.api.closeUI === "function") {
      return record.api.closeUI;
    }
    if (typeof record.api.dismissUi === "function") {
      return record.api.dismissUi;
    }
    return null;
  }

  function closeRuntimeModuleUi(moduleId, reason) {
    var requestedId = normalizeRuntimeModuleId(moduleId || "");
    var targetIds = [];
    var results = [];
    var handledCount = 0;
    var closedCount = 0;
    var i;

    if (requestedId) {
      if (!getRuntimeModuleRecord(requestedId)) {
        throw new Error("runtime_module_not_found:" + requestedId);
      }
      targetIds.push(requestedId);
    } else if (Array.isArray(state.runtimeModuleIds)) {
      targetIds = state.runtimeModuleIds.slice();
    }

    for (i = 0; i < targetIds.length; i += 1) {
      var record = getRuntimeModuleRecord(targetIds[i]);
      var entry = {
        moduleId: targetIds[i],
        enabled: !!(record && record.enabled),
        active: !!(record && record.active),
        handled: false,
        closed: false,
        error: null,
        result: null
      };
      var hook = resolveRuntimeModuleCloseUiHook(record);
      if (!hook) {
        results.push(entry);
        continue;
      }
      try {
        var hookResult = hook.call(record.api, reason || "runtime-module-close-ui");
        entry.handled = true;
        entry.result = cloneJsonValue(hookResult, hookResult);
        entry.closed = hookResult === false ? false : true;
        handledCount += 1;
        if (entry.closed) {
          closedCount += 1;
        }
      } catch (err) {
        entry.error = String(err && err.message ? err.message : err);
      }
      results.push(entry);
    }

    return {
      requestedModuleId: requestedId || null,
      requestedCount: targetIds.length,
      handledCount: handledCount,
      closedCount: closedCount,
      results: results
    };
  }

  function setRuntimeModuleEnabled(moduleId, enabled, persistReason) {
    var record = getRuntimeModuleRecord(moduleId);
    if (!record) {
      return false;
    }

    var desired = !!enabled;
    record.enabled = desired;
    record.lastError = "";

    var ok = desired ? enableRuntimeModule(record, persistReason || "toggle") : disableRuntimeModule(record, persistReason || "toggle");
    if (!ok && desired) {
      record.enabled = false;
    }

    syncRuntimeModuleRow(record);

    if (persistReason === "menu") {
      sendPacket("lua_runtime_module_toggle", {
        moduleId: record.id,
        enabled: !!record.enabled
      });
    }

    return ok;
  }

  function teardownRuntimeModules(reason) {
    if (!state.runtimeModuleIds) {
      removeRuntimeModuleMenu();
      return;
    }

    for (var i = 0; i < state.runtimeModuleIds.length; i += 1) {
      var record = getRuntimeModuleRecord(state.runtimeModuleIds[i]);
      if (record) {
        disableRuntimeModule(record, reason || "uninstall");
      }
    }
    removeRuntimeModuleMenu();
  }

  function ensureRuntimeModuleMenuUi() {
    if (!state.runtimeModuleRegistry) {
      state.runtimeModuleRegistry = Object.create(null);
    }
    if (!state.runtimeModuleIds) {
      state.runtimeModuleIds = [];
    }

    var style = document.getElementById("ModUiExtractor-runtime-module-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "ModUiExtractor-runtime-module-style";
      style.textContent = ""
        + "#ModUiExtractor-runtime-module-button{position:fixed;top:10px;left:10px;z-index:2147482600;width:34px;height:34px;border:1px solid rgba(130,170,190,.7);border-radius:8px;background:rgba(14,20,24,.92);color:#d7edf6;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);}" 
        + "#ModUiExtractor-runtime-module-button:hover{background:rgba(25,34,40,.96);border-color:rgba(170,220,240,.95);}" 
        + "#ModUiExtractor-runtime-module-panel{position:fixed;top:50px;left:10px;z-index:2147482600;min-width:260px;max-width:360px;max-height:60vh;overflow:auto;padding:10px;background:rgba(10,14,18,.97);border:1px solid rgba(100,150,170,.7);border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.4);color:#dce8ee;font:13px/1.35 'Segoe UI',sans-serif;}"
        + ".ModUiExtractor-runtime-module-title{margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8fb3c2;}"
        + ".ModUiExtractor-runtime-module-empty{padding:8px 4px;color:#8ea2ad;}"
        + ".ModUiExtractor-runtime-module-row{display:flex;gap:0;align-items:flex-start;padding:8px 6px;border-radius:8px;cursor:pointer;}"
        + ".ModUiExtractor-runtime-module-row:hover{background:rgba(255,255,255,.05);}"
        + ".ModUiExtractor-runtime-module-row[data-active='1']{background:rgba(39,119,93,.18);}"
        + ".ModUiExtractor-runtime-module-row[data-error='1']{background:rgba(138,49,49,.18);}"
        + ".ModUiExtractor-runtime-module-row input{margin-top:2px;flex:0 0 auto;}"
        + ".ModUiExtractor-runtime-module-meta{display:flex;flex-direction:column;gap:2px;min-width:0;margin-left:6px;}"
        + ".ModUiExtractor-runtime-module-name{font-weight:600;color:#eef7fb;}"
        + ".ModUiExtractor-runtime-module-desc{color:#9ab1bc;}"
        + ".ModUiExtractor-runtime-module-error{display:none;font-size:11px;color:#f2b4b4;word-break:break-word;}";
      (document.head || document.documentElement || document.body).appendChild(style);
    }

    var button = document.getElementById("ModUiExtractor-runtime-module-button");
    if (!button) {
      button = document.createElement("button");
      button.id = "ModUiExtractor-runtime-module-button";
      button.type = "button";
      button.textContent = "⋮";
      button.title = "Runtime modules";
      button.setAttribute("aria-label", "Runtime modules");
      button.addEventListener("click", function (ev) {
        if (ev && typeof ev.preventDefault === "function") {
          ev.preventDefault();
        }
        if (ev && typeof ev.stopPropagation === "function") {
          ev.stopPropagation();
        }
        state.runtimeModuleMenuOpen = !state.runtimeModuleMenuOpen;
        syncRuntimeModuleMenuUi();
      }, true);
      (document.body || document.documentElement).appendChild(button);
    }

    var panel = document.getElementById("ModUiExtractor-runtime-module-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ModUiExtractor-runtime-module-panel";
      panel.style.display = "none";
      panel.innerHTML = '<div class="ModUiExtractor-runtime-module-title">Runtime Modules</div><div id="ModUiExtractor-runtime-module-list"></div>';
      panel.addEventListener("click", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") {
          ev.stopPropagation();
        }
      }, true);
      (document.body || document.documentElement).appendChild(panel);
    }

    if (!state.runtimeModuleGlobalClickBound) {
      document.addEventListener("click", function (ev) {
        if (!state.runtimeModuleMenuOpen) {
          return;
        }
        var target = ev && ev.target ? ev.target : null;
        var liveButton = document.getElementById("ModUiExtractor-runtime-module-button");
        var livePanel = document.getElementById("ModUiExtractor-runtime-module-panel");
        if ((liveButton && target && liveButton.contains(target)) || (livePanel && target && livePanel.contains(target))) {
          return;
        }
        state.runtimeModuleMenuOpen = false;
        syncRuntimeModuleMenuUi();
      }, true);
      state.runtimeModuleGlobalClickBound = true;
    }

    var list = document.getElementById("ModUiExtractor-runtime-module-list");
    if (!list) {
      syncRuntimeModuleMenuUi();
      return;
    }

    var menuIds = getRuntimeModuleMenuIds();
    var expectedKey = menuIds.join("|");
    var needsRebuild = list.getAttribute("data-runtime-module-key") !== expectedKey;
    if (!needsRebuild) {
      for (var checkIndex = 0; checkIndex < menuIds.length; checkIndex += 1) {
        if (!document.getElementById("ModUiExtractor-runtime-module-row-" + menuIds[checkIndex])) {
          needsRebuild = true;
          break;
        }
      }
    }

    if (needsRebuild) {
      list.innerHTML = "";
      list.setAttribute("data-runtime-module-key", expectedKey);

      if (!menuIds.length) {
        var empty = document.createElement("div");
        empty.className = "ModUiExtractor-runtime-module-empty";
        empty.textContent = "No runtime modules detected.";
        list.appendChild(empty);
        syncRuntimeModuleMenuUi();
        return;
      }

      for (var i = 0; i < menuIds.length; i += 1) {
        var record = getRuntimeModuleRecord(menuIds[i]);
        if (!record) {
          continue;
        }

        var row = document.createElement("label");
        row.id = "ModUiExtractor-runtime-module-row-" + record.id;
        row.className = "ModUiExtractor-runtime-module-row";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "ModUiExtractor-runtime-module-checkbox-" + record.id;
        checkbox.checked = !!record.enabled;
        checkbox.addEventListener("click", function (ev) {
          if (ev && typeof ev.stopPropagation === "function") {
            ev.stopPropagation();
          }
        }, true);
        checkbox.addEventListener("change", (function (moduleId) {
          return function (ev) {
            var nextEnabled = !!(ev && ev.target && ev.target.checked);
            setRuntimeModuleEnabled(moduleId, nextEnabled, "menu");
          };
        })(record.id), true);
        row.appendChild(checkbox);

        var meta = document.createElement("div");
        meta.className = "ModUiExtractor-runtime-module-meta";

        var name = document.createElement("div");
        name.className = "ModUiExtractor-runtime-module-name";
        name.textContent = record.name;
        meta.appendChild(name);

        if (record.description) {
          var desc = document.createElement("div");
          desc.className = "ModUiExtractor-runtime-module-desc";
          desc.textContent = record.description;
          meta.appendChild(desc);
        }

        var error = document.createElement("div");
        error.className = "ModUiExtractor-runtime-module-error";
        meta.appendChild(error);

        row.appendChild(meta);
        list.appendChild(row);
        syncRuntimeModuleRow(record);
      }
    }

    syncRuntimeModuleMenuUi();
  }

  function registerConfiguredRuntimeModules() {
    var defs = getConfiguredRuntimeModules();
    state.runtimeModuleRegistry = Object.create(null);
    state.runtimeModuleIds = [];

    for (var i = 0; i < defs.length; i += 1) {
      var def = defs[i] || {};
      var id = normalizeRuntimeModuleId(def.id || def.name || ("module-" + (i + 1)));
      if (!id || state.runtimeModuleRegistry[id]) {
        continue;
      }

      var record = {
        id: id,
        name: String(def.name || id),
        description: String(def.description || ""),
        version: String(def.version || ""),
        source: String(def.code || ""),
        config: def.config && typeof def.config === "object" ? def.config : {},
        state: def.state && typeof def.state === "object" ? cloneJsonValue(def.state, {}) : {},
        enabled: !!def.enabled,
        active: false,
        busy: false,
        lastError: "",
        factory: null,
        ctx: null,
        api: null,
        order: typeof def.order === "number" ? def.order : i
      };

      state.runtimeModuleRegistry[id] = record;
      state.runtimeModuleIds.push(id);
    }

    state.runtimeModuleIds.sort(function (a, b) {
      var ra = getRuntimeModuleRecord(a);
      var rb = getRuntimeModuleRecord(b);
      if (!ra || !rb) {
        return a < b ? -1 : 1;
      }
      if (ra.order !== rb.order) {
        return ra.order - rb.order;
      }
      return ra.name.localeCompare(rb.name);
    });

    for (var j = 0; j < state.runtimeModuleIds.length; j += 1) {
      var recordToEnable = getRuntimeModuleRecord(state.runtimeModuleIds[j]);
      if (recordToEnable && recordToEnable.enabled) {
        enableRuntimeModule(recordToEnable, "startup");
      }
    }
  }

  state.closeRuntimeModuleUi = closeRuntimeModuleUi;
  state.runtimeModules = state.runtimeModules || {};
  state.runtimeModules.closeUi = closeRuntimeModuleUi;
  state.runtimeModules.getRecord = getRuntimeModuleRecord;
  state.runtimeModules.setEnabled = setRuntimeModuleEnabled;

  registerConfiguredRuntimeModules();
  ensureRuntimeModuleMenuUi();
