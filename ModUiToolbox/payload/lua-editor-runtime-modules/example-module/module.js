function (ctx) {
  return {
    install: function () {
      ctx.addStyle(
        "#ModUiToolbox-example-module-badge{" +
        "position:fixed;left:10px;bottom:10px;z-index:2147482500;" +
        "padding:8px 10px;border-radius:8px;" +
        "background:rgba(20,28,34,.94);border:1px solid rgba(111,216,152,.7);" +
        "color:#dff7e7;font:12px/1.2 'Segoe UI',sans-serif;" +
        "box-shadow:0 8px 20px rgba(0,0,0,.3);}" +
        "#ModUiToolbox-example-module-badge strong{color:#6fd898;}",
        "example-module"
      );

      var badge = document.createElement("div");
      badge.id = "ModUiToolbox-example-module-badge";
      badge.innerHTML = "<strong>Runtime module</strong><br>" + String((ctx.config && ctx.config.label) || "Example module active");
      document.body.appendChild(badge);
      ctx.trackNode(badge);
    }
  };
}
