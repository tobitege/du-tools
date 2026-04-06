
  function normalizeLegacyThemeName(themeName) {
    var map = {
      green: "monokai",
      yellow: "github-dark",
      red: "gruvbox-dark",
      black: "daisy-black",
      forest: "daisy-forest",
      smooth: "daisy-smooth"
    };
    var key = String(themeName || "").toLowerCase();
    return map[key] || themeName;
  }

  function flushThemeCatalogCallbacks(payload) {
    var callbacks = state.themeCatalogCallbacks || [];
    state.themeCatalogCallbacks = [];
    for (var i = 0; i < callbacks.length; i += 1) {
      try {
        callbacks[i](payload);
      } catch (_ignoreThemeCatalogCallback) {}
    }
  }

  function receiveThemeCatalog(payload) {
    var data = payload && typeof payload === "object" ? payload : null;
    state.themeCatalogLoading = false;
    state.themeCatalogRequestId = "";
    if (!data || data.success === false || !data.catalog || typeof data.catalog !== "object") {
      flushThemeCatalogCallbacks(null);
      return null;
    }

    state.themeCatalog = data.catalog;
    saveThemeCatalogCache(data.catalog);
    flushThemeCatalogCallbacks(data.catalog);
    return data.catalog;
  }

  function ensureThemeCatalogLoaded(onReady) {
    if (typeof onReady === "function") {
      if (!state.themeCatalogCallbacks) {
        state.themeCatalogCallbacks = [];
      }
      state.themeCatalogCallbacks.push(onReady);
    }

    if (state.themeCatalog && typeof state.themeCatalog === "object") {
      flushThemeCatalogCallbacks(state.themeCatalog);
      return;
    }

    var cached = loadThemeCatalogCache();
    if (cached && typeof cached === "object") {
      state.themeCatalog = cached;
      flushThemeCatalogCallbacks(cached);
      return;
    }

    if (state.themeCatalogLoading) {
      return;
    }

    state.themeCatalogLoading = true;
    state.themeCatalogRequestId = "theme-catalog-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    sendPacket("theme_catalog_request", {
      requestId: state.themeCatalogRequestId,
      catalogName: "flowery-daisy"
    });
  }

  function getThemeByName(themeName) {
    var wanted = normalizeLegacyThemeName(themeName);
    if (!wanted) {
      return normalizeThemeDefinition(colorThemes[0]);
    }
    for (var i = 0; i < colorThemes.length; i += 1) {
      if (colorThemes[i].name === wanted) {
        return normalizeThemeDefinition(colorThemes[i]);
      }
    }
    var compactTheme = findCompactThemeByName(wanted);
    if (compactTheme) {
      return normalizeThemeDefinition(buildThemeFromCompact(compactTheme));
    }
    return null;
  }

  function updateThemeDotSelection(activeThemeName) {
    var dots = document.querySelectorAll(".lua-theme-dot");
    if (!dots || !dots.length) {
      return;
    }
    for (var i = 0; i < dots.length; i += 1) {
      var dot = dots[i];
      var isActive = String(dot.getAttribute("data-theme") || "") === activeThemeName;
      dot.setAttribute("data-active", isActive ? "1" : "0");
    }
  }

  function updateThemeCatalogSelection(activeThemeName) {
    var items = document.querySelectorAll(".lua-theme-catalog-item");
    if (!items || !items.length) {
      return;
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var isActive = String(item.getAttribute("data-theme") || "") === activeThemeName;
      item.setAttribute("data-active", isActive ? "1" : "0");
      item.setAttribute("tabindex", isActive ? "0" : "-1");
    }
  }

  function updateThemeOffButtonSelection() {
    var buttons = document.querySelectorAll(".lua-theme-off-button");
    if (!buttons || !buttons.length) {
      return;
    }
    var isOff = !state.themeEnabled;
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      button.setAttribute("data-active", isOff ? "1" : "0");
      button.setAttribute("aria-pressed", isOff ? "true" : "false");
      button.setAttribute("title", isOff ? "Theme is off" : "Turn theme off");
    }
  }

  function setThemeRootActive(root, enabled) {
    if (!root) {
      return;
    }
    try {
      if (enabled) {
        root.setAttribute("data-lua-probe-active", "1");
      } else {
        root.removeAttribute("data-lua-probe-active");
      }
    } catch (_ignoreThemeRootActive) {}
  }

  function getGlobalMenuThemeRoot() {
    var root = document.querySelector(".global_inputs_wrapper");
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return null;
    }
    return root;
  }

  function getInventoryThemeRoot() {
    var root = document.getElementById("inventory");
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return null;
    }
    return root;
  }

  function normalizeInventoryItemName(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function refreshInventoryThemeAnnotations(root) {
    var slots;
    var i;
    if (!root || !root.querySelectorAll) {
      return;
    }
    slots = root.querySelectorAll(".item_slot");
    for (i = 0; i < slots.length; i += 1) {
      var slot = slots[i];
      var wrapper = slot.querySelector(".item_wrapper");
      var nameEl = slot.querySelector(".item_name");
      var normalizedName = normalizeInventoryItemName(nameEl ? nameEl.textContent : "");
      var isOwnerUnclaimed = !!wrapper && !!wrapper.classList && wrapper.classList.contains("owner_unclaimed");
      var isExcludedBigfoot = normalizedName.indexOf("poin bigfoot") >= 0;
      if (isOwnerUnclaimed && !isExcludedBigfoot) {
        slot.setAttribute("data-modui-inventory-unclaimed-tool", "1");
      } else {
        slot.removeAttribute("data-modui-inventory-unclaimed-tool");
      }
    }
  }

  function setInventoryHudLightActive(active, root) {
    var body = document.body || document.documentElement;
    if (!body || !body.setAttribute || !body.removeAttribute) {
      return;
    }
    if (active) {
      body.setAttribute("data-modui-inventory-light-active", "1");
      if (body.style && typeof body.style.setProperty === "function" && root && root.style && typeof root.style.getPropertyValue === "function") {
        body.style.setProperty("--modui-inventory-shortcut-color", root.style.getPropertyValue("--lua-probe-text-muted") || "#333c4d");
      }
    } else {
      body.removeAttribute("data-modui-inventory-light-active");
      if (body.style && typeof body.style.removeProperty === "function") {
        body.style.removeProperty("--modui-inventory-shortcut-color");
      }
    }
  }

  function ensureInventoryThemeStyle() {
    var styleId = "ModUiToolbox-inventory-theme-style";
    var style = document.getElementById(styleId);
    var rootSelector = "#inventory[data-lua-probe-active=\"1\"]";
    var lightRootSelector = "#inventory[data-lua-probe-active=\"1\"][data-lua-probe-theme-light=\"1\"]";
    var popupInspectorRootSelector = "body[data-lua-probe-active=\"1\"] .basic_window.item_inspector_win";
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      (document.head || document.documentElement || document.body).appendChild(style);
    }
    style.textContent = ""
      + rootSelector + "{"
      + "background-color:var(--lua-probe-surface-main) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;}"
      + rootSelector + " .container_layout_wrapper,"
      + rootSelector + " .container_header_wrapper,"
      + rootSelector + " .container_header,"
      + rootSelector + " .wrapper_left_container_header,"
      + rootSelector + " .container_toolbar,"
      + rootSelector + " .container_body,"
      + rootSelector + " .itemsets_wrapper,"
      + rootSelector + " .itemSetView,"
      + rootSelector + " .itemset_body,"
      + rootSelector + " .item_display_wrapper.items_slots_grid,"
      + rootSelector + " .container_footer,"
      + rootSelector + " .footer_wrapper,"
      + rootSelector + " .meta_info,"
      + rootSelector + " .kbd_info{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;background-image:none !important;color:var(--lua-probe-text-muted) !important;}"
      + rootSelector + " .primary_toolbar_wrapper,"
      + rootSelector + " .secondary_toolbar_wrapper,"
      + rootSelector + " .action_input_list,"
      + rootSelector + " .containers_toggles_inputs,"
      + rootSelector + " .containers_actions_inputs_wrapper,"
      + rootSelector + " .slots_view_inputs_wrapper,"
      + rootSelector + " .itemset_filters_wrapper,"
      + rootSelector + " .searchbox_component,"
      + rootSelector + " .wrapper-dropdown .title_wrapper,"
      + rootSelector + " .filters_flyout,"
      + rootSelector + " .filters_flyout .datatree,"
      + rootSelector + " .filters_flyout .data_tree_wrapper,"
      + rootSelector + " .filters_flyout .nanopack_data_tree,"
      + rootSelector + " .filters_flyout .owner_area,"
      + rootSelector + " .selected_item_inspector_wrapper,"
      + rootSelector + " .selected_item_details_wrapper,"
      + rootSelector + " .no_market_selected_panel,"
      + rootSelector + " .meta_panel,"
      + rootSelector + " .legend_group{"
      + "background-color:var(--lua-probe-surface-elevated) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button,"
      + rootSelector + " .itemset_tabs_list .itemset_button .item_set_tab_wrapper{"
      + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button:not(.selected):hover,"
      + rootSelector + " .itemset_tabs_list .itemset_button:not(.selected):hover .item_set_tab_wrapper{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-accent-solid) !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button.selected,"
      + rootSelector + " .itemset_tabs_list .itemset_button.selected .item_set_tab_wrapper{"
      + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;color:var(--lua-probe-mode-selected-color) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button.selected .name_and_percentage,"
      + rootSelector + " .itemset_tabs_list .itemset_button.selected .name_and_percentage span,"
      + rootSelector + " .itemset_tabs_list .itemset_button.selected .capacity_percentage_label{"
      + "color:var(--lua-probe-mode-selected-color) !important;-webkit-text-fill-color:var(--lua-probe-mode-selected-color) !important;text-shadow:none !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button .gauge_current_fill{"
      + "background-color:var(--lua-probe-warning) !important;background-image:none !important;}"
      + rootSelector + " .itemset_tabs_list .itemset_button .name_and_percentage span:not(.capacity_percentage_label),"
      + rootSelector + " .dropdown_selection_label,"
      + rootSelector + " .element_label,"
      + rootSelector + " .group_title_label,"
      + rootSelector + " .title_icon_filter,"
      + rootSelector + " .item_name,"
      + rootSelector + " .item_quantity,"
      + rootSelector + " .key_legend span,"
      + rootSelector + " .key_legend kbd{"
      + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
      + rootSelector + " .capacity_percentage_label,"
      + rootSelector + " .sort_dropdown_area .label{"
      + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + rootSelector + " .active_container_icon,"
      + rootSelector + " .active_container_icon use,"
      + rootSelector + " .search_icon,"
      + rootSelector + " .remove_search{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + rootSelector + " .capacity_percentage_gauge_wrapper,"
      + rootSelector + " .container_footer .progressbar .track{"
      + "background-color:var(--lua-probe-surface-deep) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + rootSelector + " .gauge_current_fill{"
      + "background-color:var(--lua-probe-accent-solid) !important;background-image:none !important;}"
      + rootSelector + " .search_box{"
      + "background:transparent !important;color:var(--lua-probe-text-muted) !important;caret-color:var(--lua-probe-accent-solid) !important;}"
      + rootSelector + " .search_box::placeholder{"
      + "color:var(--lua-probe-text-dim) !important;opacity:1 !important;}"
      + rootSelector + " .wrapper-dropdown .dropdown,"
      + rootSelector + " .wrapper-dropdown .dropdown li{"
      + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;color:var(--lua-probe-text-muted) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + rootSelector + " .wrapper-dropdown .dropdown li:hover{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + rootSelector + " .item_slot,"
      + rootSelector + " .item_wrapper,"
      + rootSelector + " .item_body,"
      + rootSelector + " .item_name_wrapper{"
      + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
      + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"],"
      + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_wrapper,"
      + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_body,"
      + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_name_wrapper{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + rootSelector + " .item_slot:hover,"
      + rootSelector + " .item_slot:hover .item_wrapper,"
      + rootSelector + " .item_slot:hover .item_body,"
      + rootSelector + " .item_slot:hover .item_name_wrapper{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + rootSelector + " .item_slot.selected,"
      + rootSelector + " .item_slot.selected .item_wrapper,"
      + rootSelector + " .item_slot.selected .item_body,"
      + rootSelector + " .item_slot.selected .item_name_wrapper{"
      + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;color:var(--lua-probe-mode-selected-color) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
      + rootSelector + " .item_slot.selected .item_name,"
      + rootSelector + " .item_slot.selected .item_quantity,"
      + rootSelector + " .item_slot.selected .item_icon_name_label,"
      + rootSelector + " .item_slot.selected .item_name_wrapper *{"
      + "color:var(--lua-probe-mode-selected-color) !important;-webkit-text-fill-color:var(--lua-probe-mode-selected-color) !important;text-shadow:none !important;}"
      + rootSelector + " .container_toolbar svg.icon_button:not(.selected),"
      + rootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected),"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:not(.selected),"
      + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input:not(.selected),"
      + rootSelector + " .containers_toggles_inputs svg.icon_button:not(.selected),"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button:not(.selected){"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + rootSelector + " .container_toolbar svg.icon_button:not(.selected):hover,"
      + rootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected):hover,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:not(.selected):hover,"
      + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input:not(.selected):hover,"
      + rootSelector + " .containers_toggles_inputs svg.icon_button:not(.selected):hover,"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button:not(.selected):hover{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + rootSelector + " .container_toolbar svg.icon_button.selected,"
      + rootSelector + " .container_toolbar .toggleDataTree_containerView_input.selected,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
      + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input.selected,"
      + rootSelector + " .containers_toggles_inputs svg.icon_button.selected,"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button.selected{"
      + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
      + rootSelector + " .container_toolbar svg.icon_button.disabled:not(.selected),"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled:not(.selected),"
      + rootSelector + " .containers_toggles_inputs svg.icon_button.disabled:not(.selected),"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button.disabled:not(.selected){"
      + "background-color:var(--lua-probe-btn-disabled-bg) !important;border-color:var(--lua-probe-btn-disabled-border) !important;box-shadow:none !important;}"
      + rootSelector + " .close_button svg,"
      + rootSelector + " .close_button svg use,"
      + rootSelector + " .toggleDataTree_containerView_input svg,"
      + rootSelector + " .toggleDataTree_containerView_input svg use,"
      + rootSelector + " .containers_toggles_inputs svg.icon_button,"
      + rootSelector + " .containers_toggles_inputs svg.icon_button use,"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button,"
      + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button use,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button use{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover use,"
      + rootSelector + " .toggleDataTree_containerView_input:hover svg,"
      + rootSelector + " .toggleDataTree_containerView_input:hover svg use{"
      + "fill:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-accent-solid) !important;}"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected use,"
      + rootSelector + " .toggleDataTree_containerView_input.selected svg,"
      + rootSelector + " .toggleDataTree_containerView_input.selected svg use{"
      + "fill:var(--lua-probe-mode-selected-color) !important;color:var(--lua-probe-mode-selected-color) !important;}"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled,"
      + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled use{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;color:var(--lua-probe-btn-disabled-color) !important;}"
      + lightRootSelector + " .player_wallet_wrapper,"
      + lightRootSelector + " .player_wallet_wrapper h3,"
      + lightRootSelector + " .player_wallet,"
      + lightRootSelector + " .quanta_type,"
      + lightRootSelector + " .sort_dropdown_area .label,"
      + lightRootSelector + " .capacity_percentage_label,"
      + lightRootSelector + " .dropdown_selection_label,"
      + lightRootSelector + " .item_name,"
      + lightRootSelector + " .item_quantity,"
      + lightRootSelector + " .meta_panel .label,"
      + lightRootSelector + " .meta_panel .items_count_label,"
      + lightRootSelector + " .container_footer .container_pencentage.value,"
      + lightRootSelector + " .container_footer .container_mass.value,"
      + lightRootSelector + " .container_footer .volume_label .value,"
      + lightRootSelector + " .container_footer .mass_label .value,"
      + lightRootSelector + " .information_slider h5,"
      + lightRootSelector + " .key_legend span,"
      + lightRootSelector + " .key_legend kbd,"
      + lightRootSelector + " .item_inspector_error_wrapper,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_longname,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_description,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value .value_label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value_label{"
      + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
      + lightRootSelector + " .container_footer .container_pencentage.value,"
      + lightRootSelector + " .container_footer .container_mass.value,"
      + lightRootSelector + " .container_footer .volume_label .value,"
      + lightRootSelector + " .container_footer .mass_label .value{"
      + "color:color-mix(in srgb, var(--lua-probe-accent-solid) 58%, var(--lua-probe-text-muted) 42%) !important;}"
      + lightRootSelector + " .player_wallet_wrapper h3{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + lightRootSelector + " .container_toolbar svg.icon_button:not(.selected),"
      + lightRootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected){"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + lightRootSelector + " .container_toolbar svg.icon_button:not(.selected):hover,"
      + lightRootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected):hover{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + lightRootSelector + " .container_toolbar svg.icon_button.disabled:not(.selected){"
      + "background-color:var(--lua-probe-btn-disabled-bg) !important;border-color:var(--lua-probe-btn-disabled-border) !important;}"
      + lightRootSelector + " .close_button.close_container_button{"
      + "background:var(--lua-probe-surface-row) !important;background-image:none !important;border:1px solid var(--lua-probe-border-strong) !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;fill:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .close_button.close_container_button:hover{"
      + "background:var(--lua-probe-surface-row-alt) !important;background-image:none !important;border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;fill:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .wrapper_left_container_header .close_button svg,"
      + lightRootSelector + " .wrapper_left_container_header .close_button svg use{"
      + "fill:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label{"
      + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper,"
      + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper .item_longname,"
      + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper .item_label{"
      + "color:rgba(248,252,249,0.96) !important;text-shadow:0 1px 2px rgba(0,0,0,0.35) !important;}"
      + lightRootSelector + " .kbd_info,"
      + lightRootSelector + " .legend_group{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .key_legend{"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .key_legend span{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + lightRootSelector + " .key_legend kbd{"
      + "background:color-mix(in srgb, var(--lua-probe-accent-solid) 18%, white 82%) !important;border:1px solid color-mix(in srgb, var(--lua-probe-accent-solid) 32%, white 68%) !important;color:color-mix(in srgb, var(--lua-probe-accent-solid) 58%, var(--lua-probe-text-muted) 42%) !important;box-shadow:none !important;}"
      + "body[data-modui-inventory-light-active=\"1\"] .tools_list .shortcut{"
      + "color:var(--modui-inventory-shortcut-color, #333c4d) !important;text-shadow:0 1px 2px rgba(255,255,255,0.65) !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper,"
      + lightRootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown.open_down,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody,"
      + lightRootSelector + " .selected_item_inspector_wrapper .dropdown_no_search_result{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper{"
      + "margin-left:0.5rem !important;}"
      + rootSelector + " .selected_item_inspector_wrapper,"
      + rootSelector + " .selected_item_inspector_wrapper .item_inspector,"
      + rootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper{"
      + "display:flex !important;flex-direction:column !important;min-height:0 !important;height:100% !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper.hide{"
      + "display:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper{"
      + "padding:0 0 0.875rem 0.5rem !important;box-sizing:border-box !important;background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-main) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary{"
      + "display:flex !important;align-items:center !important;gap:12px !important;min-height:48px !important;padding:10px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-backdrop) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.55) !important;flex:0 0 auto !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-title{"
      + "flex:1 1 auto !important;min-width:0 !important;color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;text-shadow:none !important;text-transform:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-actions{"
      + "display:flex !important;align-items:center !important;gap:8px !important;margin-left:auto !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_button_wrapper,"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input{"
      + "position:static !important;top:auto !important;right:auto !important;margin:0 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_button_wrapper{"
      + "display:flex !important;align-items:center !important;gap:8px !important;height:auto !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input:not(.hide){"
      + "display:inline-flex !important;align-items:center !important;justify-content:center !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input.hide{"
      + "display:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-toggle{"
      + "display:inline-flex !important;align-items:center !important;justify-content:center !important;width:32px !important;height:32px !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-main) !important;font-size:18px !important;line-height:1 !important;cursor:pointer !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-toggle:hover{"
      + "background:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + popupInspectorRootSelector + "{"
      + "max-height:100% !important;border:1px solid rgba(111,111,111,0.42) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + ","
      + popupInspectorRootSelector + " .win_box,"
      + popupInspectorRootSelector + " .window_content,"
      + popupInspectorRootSelector + " .item_inspector,"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .window_titlebar,"
      + popupInspectorRootSelector + " .window_titlebar.win_active{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;background-image:none !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .window_title{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
      + popupInspectorRootSelector + " .window_closebutton{"
      + "background:transparent !important;border:1px solid transparent !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .window_closebutton:hover{"
      + "background:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + popupInspectorRootSelector + " .window_closebutton svg,"
      + popupInspectorRootSelector + " .window_closebutton svg use{"
      + "fill:var(--lua-probe-text-main) !important;color:var(--lua-probe-text-main) !important;}"
      + popupInspectorRootSelector + " .win_box,"
      + popupInspectorRootSelector + " .window_content,"
      + popupInspectorRootSelector + " .item_inspector,"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
      + "max-height:100% !important;min-height:0 !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper.hide{"
      + "display:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
      + "box-sizing:border-box !important;border-color:var(--lua-probe-border-strong) !important;}"
      + popupInspectorRootSelector + " .item_inspector .header_wrapper{"
      + "border-bottom:1px solid var(--lua-probe-border-strong) !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_longname{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;text-transform:none !important;text-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_label,"
      + popupInspectorRootSelector + " .item_inspector .item_description,"
      + popupInspectorRootSelector + " .item_inspector .header_label,"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_error_wrapper{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_data .label{"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_data .value{"
      + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_data .value,"
      + popupInspectorRootSelector + " .item_inspector .item_data .value .value_label,"
      + popupInspectorRootSelector + " .item_inspector .item_data .value_label{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_data .label.important{"
      + "color:var(--lua-probe-accent-solid) !important;-webkit-text-fill-color:var(--lua-probe-accent-solid) !important;font-weight:700 !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input{"
      + "background-color:var(--lua-probe-surface-row) !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input:hover{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input svg,"
      + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input svg use{"
      + "fill:var(--lua-probe-text-main) !important;color:var(--lua-probe-text-main) !important;}"
      + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown.open_down{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown .title_wrapper,"
      + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown .searchbox_component,"
      + popupInspectorRootSelector + " .item_inspector .dropdown_no_search_result{"
      + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_zone,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_generic,"
      + popupInspectorRootSelector + " .item_inspector .drillDownElementWrapper,"
      + popupInspectorRootSelector + " .item_inspector .drillDownElementChildrenZone{"
      + "background:transparent !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .drillDownElementChildrenZone{"
      + "padding-top:0 !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody{"
      + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid var(--lua-probe-border-strong) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody{"
      + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-row) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .label,"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .element_label{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;letter-spacing:0 !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_generic,"
      + popupInspectorRootSelector + " .item_inspector .drillDownElementWrapper,"
      + popupInspectorRootSelector + " .item_inspector .labelAndString.drilldownElement,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_icon_label.drilldownElement,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.drilldownElement{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody .label,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody .element_label{"
      + "text-transform:none !important;font-weight:700 !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .string,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talent_groups_name_label{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + popupInspectorRootSelector + " .item_inspector .labelAndString.drilldownElement .value,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_icon_label.drilldownElement .value,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.drilldownElement .value{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.missing_item .value{"
      + "color:rgb(222,80,58) !important;-webkit-text-fill-color:rgb(222,80,58) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent,"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talent_body{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talents_level .level{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talents_level .level.acquired{"
      + "background-color:var(--lua-probe-accent-solid) !important;border-color:var(--lua-probe-accent-solid) !important;}"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody svg,"
      + popupInspectorRootSelector + " .item_inspector .drilldownElementBody svg use{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel{"
      + "display:flex !important;flex-direction:column !important;gap:10px !important;padding:10px 14px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-elevated) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;overflow:visible !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary{"
      + "display:flex !important;align-items:center !important;gap:12px !important;min-height:48px !important;padding:10px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-backdrop) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary-title{"
      + "flex:1 1 auto !important;min-width:0 !important;color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;text-shadow:none !important;text-transform:none !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary-actions{"
      + "display:flex !important;align-items:center !important;gap:8px !important;margin-left:auto !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_button_wrapper,"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input{"
      + "position:static !important;top:auto !important;right:auto !important;margin:0 !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_button_wrapper{"
      + "display:flex !important;align-items:center !important;gap:8px !important;height:auto !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .open_in_new_inspector_button{"
      + "display:none !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input:not(.hide){"
      + "display:inline-flex !important;align-items:center !important;justify-content:center !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input.hide{"
      + "display:none !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-toggle{"
      + "display:inline-flex !important;align-items:center !important;justify-content:center !important;width:32px !important;height:32px !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-main) !important;font-size:18px !important;line-height:1 !important;cursor:pointer !important;box-shadow:none !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-toggle:hover{"
      + "background:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel{"
      + "display:flex !important;flex-direction:column !important;gap:10px !important;padding:10px 14px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-elevated) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;overflow:visible !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .header_wrapper{"
      + "display:block !important;position:relative !important;margin:0 0 0.35rem 0 !important;max-height:none !important;min-height:auto !important;height:auto !important;padding:0 0 0.6rem 0 !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;flex:0 0 auto !important;align-items:normal !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_icon_wrapper{"
      + "position:static !important;display:flex !important;justify-content:center !important;align-items:center !important;width:100% !important;min-height:0 !important;height:auto !important;flex:0 0 auto !important;text-align:center !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_icon{"
      + "display:block !important;width:auto !important;max-width:42% !important;height:auto !important;min-height:0 !important;object-fit:contain !important;margin:0 auto !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_restore_count,"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_description_wrapper{"
      + "flex:0 0 auto !important;}"
      + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .title_wrapper{"
      + "display:none !important;}"
      + popupInspectorRootSelector + " .content_wrapper{"
      + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:hidden !important;padding-top:0 !important;}"
      + popupInspectorRootSelector + " .content_wrapper .item_informations_wrapper{"
      + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:auto !important;margin-top:0 !important;}"
      + popupInspectorRootSelector + "[data-modui-inventory-inspector-collapsed=\"1\"] .modui-inventory-inspector-top-panel{"
      + "display:none !important;}"
      + popupInspectorRootSelector + "[data-modui-inventory-inspector-collapsed=\"1\"] .content_wrapper .item_informations_wrapper{"
      + "padding-top:12px !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .header_wrapper{"
      + "display:block !important;position:relative !important;margin:0 0 0.35rem 0 !important;min-height:auto !important;height:auto !important;padding:0 0 0.6rem 0 !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;flex:0 0 auto !important;align-items:normal !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_icon_wrapper{"
      + "position:static !important;display:flex !important;justify-content:center !important;align-items:center !important;width:100% !important;min-height:0 !important;height:auto !important;flex:0 0 auto !important;text-align:center !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_icon{"
      + "display:block !important;width:auto !important;max-width:42% !important;height:auto !important;min-height:0 !important;object-fit:contain !important;margin:0 auto !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_label,"
      + rootSelector + " .selected_item_inspector_wrapper .item_description,"
      + rootSelector + " .selected_item_inspector_wrapper .header_label,"
      + rootSelector + " .selected_item_inspector_wrapper .item_inspector_error_wrapper{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_longname,"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-title{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_restore_count,"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_description_wrapper{"
      + "flex:0 0 auto !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .title_wrapper{"
      + "display:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .content_wrapper{"
      + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:hidden !important;padding-top:0 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .content_wrapper .item_informations_wrapper{"
      + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:auto !important;margin-top:0 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .label{"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .value{"
      + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .value,"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .value .value_label,"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .value_label{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .item_data .label.important{"
      + "color:var(--lua-probe-accent-solid) !important;-webkit-text-fill-color:var(--lua-probe-accent-solid) !important;font-weight:700 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown.open_down{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown .title_wrapper,"
      + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown .searchbox_component,"
      + rootSelector + " .selected_item_inspector_wrapper .dropdown_no_search_result{"
      + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper[data-modui-inventory-inspector-collapsed=\"1\"] .modui-inventory-inspector-top-panel{"
      + "display:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper[data-modui-inventory-inspector-collapsed=\"1\"] .content_wrapper .item_informations_wrapper{"
      + "padding-top:12px !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_zone,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
      + rootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
      + rootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
      + "background:transparent !important;box-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
      + "padding-top:0 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody{"
      + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid var(--lua-probe-border-strong) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody{"
      + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-row) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;letter-spacing:0 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
      + rootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
      + rootSelector + " .selected_item_inspector_wrapper .labelAndString.drilldownElement,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_icon_label.drilldownElement,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.drilldownElement{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .label,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .element_label{"
      + "text-transform:none !important;font-weight:700 !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_groups_name_label{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .labelAndString.drilldownElement .value,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_icon_label.drilldownElement .value,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.drilldownElement .value{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.missing_item .value{"
      + "color:rgb(222,80,58) !important;-webkit-text-fill-color:rgb(222,80,58) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_body{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talents_level .level{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-strong) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talents_level .level.acquired{"
      + "background-color:var(--lua-probe-accent-solid) !important;border-color:var(--lua-probe-accent-solid) !important;}"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg,"
      + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg use{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_zone,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
      + "background:transparent !important;box-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
      + "padding-top:0 !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody{"
      + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid rgba(84,122,135,0.22) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody{"
      + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid rgba(51,60,77,0.32) !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label{"
      + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value{"
      + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label.important{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:700 !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .dropdown_selection_label.have_selection{"
      + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label{"
      + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:600 !important;letter-spacing:0 !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .label,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .element_label{"
      + "text-transform:none !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:700 !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_groups_name_label{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string{"
      + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;font-weight:600 !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg,"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg use{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .item_icon{"
      + "width:1.75rem !important;height:1.75rem !important;min-height:0 !important;}"
      + lightRootSelector + " .close_button svg,"
      + lightRootSelector + " .close_button svg use,"
      + lightRootSelector + " .toggleDataTree_containerView_input svg,"
      + lightRootSelector + " .toggleDataTree_containerView_input svg use,"
      + lightRootSelector + " .containers_toggles_inputs svg.icon_button,"
      + lightRootSelector + " .containers_toggles_inputs svg.icon_button use,"
      + lightRootSelector + " .containers_actions_inputs_wrapper svg.icon_button,"
      + lightRootSelector + " .containers_actions_inputs_wrapper svg.icon_button use,"
      + lightRootSelector + " .slots_view_inputs_wrapper svg.icon_button,"
      + lightRootSelector + " .slots_view_inputs_wrapper svg.icon_button use,"
      + lightRootSelector + " .searchbox_component svg,"
      + lightRootSelector + " .searchbox_component svg use,"
      + lightRootSelector + " .information_slider svg,"
      + lightRootSelector + " .information_slider svg use,"
      + lightRootSelector + " .item_owner .icon_fit_wrapper,"
      + lightRootSelector + " .item_owner .icon_fit_wrapper use{"
      + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover,"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover use,"
      + lightRootSelector + " .toggleDataTree_containerView_input:hover svg,"
      + lightRootSelector + " .toggleDataTree_containerView_input:hover svg use{"
      + "fill:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-accent-solid) !important;}"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected use,"
      + lightRootSelector + " .toggleDataTree_containerView_input.selected svg,"
      + lightRootSelector + " .toggleDataTree_containerView_input.selected svg use{"
      + "fill:var(--lua-probe-mode-selected-color) !important;color:var(--lua-probe-mode-selected-color) !important;}"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled,"
      + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled use{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;color:var(--lua-probe-btn-disabled-color) !important;}";
  }

  function syncEditorThemeActivation() {
    var luaRoot = document.getElementById("dpu_editor");
    var screenRoot = getScreenEditorRoot();
    var bodyRoot = document.body || null;
    var globalMenuRoot = getGlobalMenuThemeRoot();
    var inventoryRoot = getInventoryThemeRoot();
    var extraRoots = document.querySelectorAll("[data-modui-theme-target=\"1\"]");
    setThemeRootActive(bodyRoot, !!state.themeEnabled);
    setThemeRootActive(luaRoot, !!state.themeEnabled);
    setThemeRootActive(screenRoot, !!state.themeEnabled && !!screenRoot && isElementVisible(screenRoot));
    setThemeRootActive(globalMenuRoot, !!state.themeEnabled && !!globalMenuRoot);
    setThemeRootActive(inventoryRoot, !!state.themeEnabled && !!inventoryRoot && isElementVisible(inventoryRoot));
    if (extraRoots && typeof extraRoots.length === "number") {
      for (var i = 0; i < extraRoots.length; i += 1) {
        setThemeRootActive(extraRoots[i], !!state.themeEnabled);
      }
    }
    updateThemeOffButtonSelection();
  }

  function setThemeEnabled(enabled, persist) {
    state.themeEnabled = !!enabled;
    if (persist !== false) {
      saveThemeEnabledPreference(state.themeEnabled);
    }
    syncEditorThemeActivation();
    return state.themeEnabled;
  }

  function isThemeEnabled() {
    return !!state.themeEnabled;
  }

  function parseHexColor(hex) {
    var value = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (value.length === 3) {
      value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
    }
    if (value.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function clampColorByte(value) {
    var n = Math.round(Number(value) || 0);
    if (n < 0) {
      return 0;
    }
    if (n > 255) {
      return 255;
    }
    return n;
  }

  function toHexColor(rgb) {
    function toPart(value) {
      var part = clampColorByte(value).toString(16);
      return part.length < 2 ? "0" + part : part;
    }
    return "#" + toPart(rgb.r) + toPart(rgb.g) + toPart(rgb.b);
  }

  function mixHexColor(a, b, amount) {
    var left = parseHexColor(a);
    var right = parseHexColor(b);
    var t = typeof amount === "number" ? amount : 0.5;
    if (t < 0) {
      t = 0;
    }
    if (t > 1) {
      t = 1;
    }
    return toHexColor({
      r: left.r + (right.r - left.r) * t,
      g: left.g + (right.g - left.g) * t,
      b: left.b + (right.b - left.b) * t
    });
  }

  function withAlpha(hex, alpha) {
    var rgb = parseHexColor(hex);
    var a = typeof alpha === "number" ? alpha : 1;
    if (a < 0) {
      a = 0;
    }
    if (a > 1) {
      a = 1;
    }
    return "rgba(" + clampColorByte(rgb.r) + "," + clampColorByte(rgb.g) + "," + clampColorByte(rgb.b) + "," + a + ")";
  }

  function isLightHexColor(hex) {
    var rgb = parseHexColor(hex);
    var luminance = (rgb.r * 0.299) + (rgb.g * 0.587) + (rgb.b * 0.114);
    return luminance >= 160;
  }

  function resolveThemeLightFlag(theme, fallbackHex) {
    if (theme && typeof theme === "object") {
      if (typeof theme.isLight === "boolean") {
        return theme.isLight;
      }
      if (typeof theme.il === "boolean") {
        return theme.il;
      }
    }
    return isLightHexColor(fallbackHex || (theme && (theme.surfaceMain || theme.surfaceElevated || theme.dot)) || "#000000");
  }

  function normalizeThemeDefinition(theme, fallbackHex) {
    if (!theme || typeof theme !== "object") {
      return theme;
    }
    var isLight = resolveThemeLightFlag(theme, fallbackHex);
    theme.isLight = isLight;
    return theme;
  }

  function getRelativeLuminance(hex) {
    var rgb = parseHexColor(hex);
    function toLinear(value) {
      var n = clampColorByte(value) / 255;
      return n <= 0.03928 ? (n / 12.92) : Math.pow((n + 0.055) / 1.055, 2.4);
    }
    return (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b));
  }

  function getContrastRatio(a, b) {
    var left = getRelativeLuminance(a);
    var right = getRelativeLuminance(b);
    var lighter = left > right ? left : right;
    var darker = left > right ? right : left;
    return (lighter + 0.05) / (darker + 0.05);
  }

  function pickReadableTextColor(background, preferred, dark, light, minRatio) {
    var bg = String(background || "#000000");
    var want = String(preferred || "");
    var darkText = String(dark || "#111111");
    var lightText = String(light || "#f8f8f2");
    var min = typeof minRatio === "number" ? minRatio : 4.5;
    var best = want;
    var bestRatio = best ? getContrastRatio(bg, best) : 0;
    if (best && bestRatio >= min) {
      return best;
    }
    var darkRatio = getContrastRatio(bg, darkText);
    var lightRatio = getContrastRatio(bg, lightText);
    return darkRatio >= lightRatio ? darkText : lightText;
  }

  function pickReadableTextColorForBackgrounds(backgrounds, preferred, dark, light, minRatio) {
    var list = Array.isArray(backgrounds) ? backgrounds : [backgrounds];
    var want = String(preferred || "");
    var darkText = String(dark || "#111111");
    var lightText = String(light || "#f8f8f2");
    var min = typeof minRatio === "number" ? minRatio : 4.5;
    var i;
    var bg;
    var preferredMin = Infinity;
    var darkMin = Infinity;
    var lightMin = Infinity;
    for (i = 0; i < list.length; i += 1) {
      bg = String(list[i] || "#000000");
      if (want) {
        preferredMin = Math.min(preferredMin, getContrastRatio(bg, want));
      }
      darkMin = Math.min(darkMin, getContrastRatio(bg, darkText));
      lightMin = Math.min(lightMin, getContrastRatio(bg, lightText));
    }
    if (want && preferredMin >= min) {
      return want;
    }
    if (darkMin >= min || lightMin >= min) {
      return darkMin >= lightMin ? darkText : lightText;
    }
    return darkMin >= lightMin ? darkText : lightText;
  }

  function ensureReadableAccentColor(background, color, minRatio) {
    var bg = String(background || "#000000");
    var candidate = String(color || "");
    var min = typeof minRatio === "number" ? minRatio : 3.4;
    if (candidate && getContrastRatio(bg, candidate) >= min) {
      return candidate;
    }
    var target = isLightHexColor(bg) ? "#111111" : "#f8f8f2";
    if (!candidate) {
      candidate = target;
    }
    for (var i = 1; i <= 10; i += 1) {
      var mixed = mixHexColor(candidate, target, i / 10);
      if (getContrastRatio(bg, mixed) >= min) {
        return mixed;
      }
    }
    return pickReadableTextColor(bg, candidate, "#111111", "#f8f8f2", min);
  }

  function shadeHexColor(hex, amount) {
    return amount >= 0
      ? mixHexColor(hex, "#ffffff", amount)
      : mixHexColor(hex, "#000000", -amount);
  }

  function normalizeThemeCatalogLabel(label) {
    var text = String(label || "").replace(/^daisy\s+/i, "").trim();
    return text || "Theme";
  }

  function getEventKeyName(event) {
    var key = event && event.key ? String(event.key) : "";
    if (key) {
      if (key === "Left") { return "ArrowLeft"; }
      if (key === "Right") { return "ArrowRight"; }
      if (key === "Up") { return "ArrowUp"; }
      if (key === "Down") { return "ArrowDown"; }
      if (key === "Esc") { return "Escape"; }
      if (key === "Spacebar") { return " "; }
      if (key !== "Unidentified") {
        return key;
      }
    }
    var code = event ? (event.which || event.keyCode || event.charCode || 0) : 0;
    if (code === 37) { return "ArrowLeft"; }
    if (code === 38) { return "ArrowUp"; }
    if (code === 39) { return "ArrowRight"; }
    if (code === 40) { return "ArrowDown"; }
    if (code === 13) { return "Enter"; }
    if (code === 27) { return "Escape"; }
    if (code === 32) { return " "; }
    if (code === 36) { return "Home"; }
    if (code === 35) { return "End"; }
    return "";
  }

  function buildLinearGradient(top, mid, bottom) {
    return "linear-gradient(180deg," + top + " 0%," + mid + " 45%," + bottom + " 100%)";
  }

  function findCompactThemeByName(themeName) {
    var catalog = state.themeCatalog;
    var wanted = normalizeLegacyThemeName(themeName);
    if (!catalog || !catalog.themes || typeof catalog.themes.length !== "number") {
      return null;
    }
    for (var i = 0; i < catalog.themes.length; i += 1) {
      var entry = catalog.themes[i];
      if (entry && String(entry.n || "") === wanted) {
        return entry;
      }
    }
    return null;
  }

  function buildThemeFromCompact(compact) {
    var themeName = String(compact.n || "catalog-theme");
    var primary = String(compact.p || compact.d || "#58a6ff");
    var primaryFocus = String(compact.pf || primary);
    var primaryContent = pickReadableTextColor(primary, compact.pc || (isLightHexColor(primary) ? "#101418" : "#f8f8f2"), "#101418", "#f8f8f2", 4.5);
    var neutral = String(compact.nu || "#20242a");
    var base100 = String(compact.b1 || "#0d1117");
    var base200 = String(compact.b2 || shadeHexColor(base100, isLightHexColor(base100) ? -0.06 : 0.08));
    var base300 = String(compact.b3 || shadeHexColor(base200, isLightHexColor(base200) ? -0.12 : 0.12));
    var isLightBase = resolveThemeLightFlag(compact, base100);
    var baseContent = pickReadableTextColor(base100, compact.bc || (isLightHexColor(base100) ? "#111111" : "#d8dee4"), "#111111", "#f8f8f2", 5.5);
    var neutralContent = pickReadableTextColor(neutral, compact.nc || baseContent, "#111111", "#f8f8f2", 4.5);
    var info = String(compact.i || primary);
    var warning = String(compact.w || primary);
    var row = isLightBase
      ? mixHexColor(base100, base200, 0.72)
      : mixHexColor(base200, base300, 0.38);
    var rowAlt = isLightBase
      ? mixHexColor(base200, base300, 0.32)
      : mixHexColor(base200, neutral, 0.18);
    var deep = isLightBase
      ? mixHexColor(base200, base300, 0.58)
      : mixHexColor(base100, neutral, 0.55);
    var surfaceBackdrop = mixHexColor(base200, deep, isLightBase ? 0.52 : 0.42);
    var textMuted = pickReadableTextColor(base200, baseContent, "#111111", "#f8f8f2", 4.5);
    var textDim = pickReadableTextColor(base200, mixHexColor(baseContent, base300, 0.55), shadeHexColor(textMuted, isLightHexColor(base200) ? -0.3 : 0.3), textMuted, 3.2);
    var comment = pickReadableTextColor(deep, mixHexColor(baseContent, base300, 0.68), "#4f5964", "#9ea8b3", 3.2);
    var cmText = pickReadableTextColor(deep, baseContent, "#111111", "#f8f8f2", 5.5);
    var cmKeyword = ensureReadableAccentColor(deep, primary, 4.2);
    var cmAtom = ensureReadableAccentColor(deep, info, 3.6);
    var cmString = ensureReadableAccentColor(deep, compact.g || "#2ea043", 3.6);
    var cmNumber = ensureReadableAccentColor(deep, warning, 3.6);
    var cmDef = ensureReadableAccentColor(deep, primaryFocus, 3.8);
    var cmBuiltin = ensureReadableAccentColor(deep, compact.a || primaryFocus || primary, 3.8);
    var cmVariable = cmText;
    var cmVariable2 = ensureReadableAccentColor(deep, mixHexColor(info, primary, 0.45), 3.6);
    var cmOperator = pickReadableTextColor(deep, mixHexColor(cmText, base300, 0.18), "#2b3137", "#d8dee4", 3.2);
    var cmProperty = ensureReadableAccentColor(deep, mixHexColor(primary, info, 0.25), 3.6);
    var borderStrong = isLightBase ? mixHexColor(base300, baseContent, 0.1) : mixHexColor(base300, neutral, 0.15);
    var borderHover = info;
    var selectionBorder = withAlpha(primary, 0.92);
    var modeSelectedTop = shadeHexColor(primary, 0.16);
    var modeSelectedMid = shadeHexColor(primary, 0.05);
    var modeSelectedBottom = shadeHexColor(primaryFocus, -0.08);
    var modeSelectedBg = buildLinearGradient(modeSelectedTop, modeSelectedMid, modeSelectedBottom);
    var modeSelectedBorder = withAlpha(primary, 0.78);
    var modeSelectedColor;
    var btnApplyColor = primaryContent;
    if (themeName === "daisy-black") {
      borderHover = "#6fbfff";
      selectionBorder = "rgba(111,191,255,0.92)";
      modeSelectedTop = "#7fd0ff";
      modeSelectedMid = "#58a9ff";
      modeSelectedBottom = "#2f76d9";
      modeSelectedBg = buildLinearGradient(modeSelectedTop, modeSelectedMid, modeSelectedBottom);
      modeSelectedBorder = "rgba(111,191,255,0.92)";
    }
    modeSelectedColor = pickReadableTextColorForBackgrounds(
      [modeSelectedTop, modeSelectedMid, modeSelectedBottom],
      compact.pc || primaryContent,
      "#101418",
      "#f8f8f2",
      4.5
    );
    if (isLightBase) {
      btnApplyColor = "#ffffff";
    }
    var btnDisabledBg = buildLinearGradient(shadeHexColor(base200, isLightBase ? -0.03 : 0.04), rowAlt, shadeHexColor(deep, isLightBase ? -0.08 : -0.02));
    var btnDisabledBorder = withAlpha(borderStrong, isLightBase ? 0.6 : 0.5);
    var btnDisabledColor = withAlpha(textDim, isLightBase ? 0.92 : 0.72);
    return {
      name: themeName,
      label: normalizeThemeCatalogLabel(compact.l || compact.n || "Catalog Theme"),
      isLight: isLightBase,
      dot: String(compact.d || primary),
      accent: withAlpha(primary, 0.92),
      warning: warning,
      header: withAlpha(base100, 0.97),
      caretBg: withAlpha(primary, isLightHexColor(base100) ? 0.12 : 0.18),
      accentSolid: primary,
      onAccent: primaryContent,
      surfaceMain: base100,
      surfaceElevated: base200,
      surfaceBackdrop: surfaceBackdrop,
      surfaceRow: row,
      surfaceDeep: deep,
      surfaceRowAlt: rowAlt,
      borderStrong: borderStrong,
      borderHover: borderHover,
      selectionBorder: selectionBorder,
      shadow: isLightHexColor(base100) ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)",
      textMuted: textMuted,
      textDim: textDim,
      cmText: cmText,
      cmComment: comment,
      cmLineNumber: textDim,
      cmKeyword: cmKeyword,
      cmAtom: cmAtom,
      cmString: cmString,
      cmNumber: cmNumber,
      cmDef: cmDef,
      cmBuiltin: cmBuiltin,
      cmVariable: cmVariable,
      cmVariable2: cmVariable2,
      cmOperator: cmOperator,
      cmProperty: cmProperty,
      gutterBorder: mixHexColor(base200, base300, 0.5),
      btnApplyBg: buildLinearGradient(shadeHexColor(primary, 0.08), mixHexColor(primary, primaryFocus, 0.55), shadeHexColor(primaryFocus, -0.18)),
      btnApplyBorder: withAlpha(primary, 0.78),
      btnApplyColor: btnApplyColor,
      btnApplyHoverBg: buildLinearGradient(shadeHexColor(primary, 0.16), shadeHexColor(primary, 0.05), shadeHexColor(primaryFocus, -0.08)),
      btnApplyActiveBg: buildLinearGradient(shadeHexColor(primaryFocus, -0.02), shadeHexColor(primaryFocus, -0.12), shadeHexColor(primaryFocus, -0.24)),
      modeSelectedBg: modeSelectedBg,
      modeSelectedBorder: modeSelectedBorder,
      modeSelectedColor: modeSelectedColor,
      btnCancelBg: buildLinearGradient(shadeHexColor(neutral, 0.1), neutral, shadeHexColor(neutral, -0.12)),
      btnCancelBorder: withAlpha(base300, 0.55),
      btnCancelColor: neutralContent,
      btnCancelHoverBg: buildLinearGradient(shadeHexColor(neutral, 0.16), shadeHexColor(neutral, 0.05), shadeHexColor(neutral, -0.04)),
      btnCancelActiveBg: buildLinearGradient(shadeHexColor(neutral, -0.02), shadeHexColor(neutral, -0.1), shadeHexColor(neutral, -0.18)),
      btnDisabledBg: btnDisabledBg,
      btnDisabledBorder: btnDisabledBorder,
      btnDisabledColor: btnDisabledColor
    };
  }

  function hideThemeCatalogPanels() {
    var panels = document.querySelectorAll(".lua-theme-catalog-panel");
    if (!panels || !panels.length) {
      return;
    }
    for (var i = 0; i < panels.length; i += 1) {
      panels[i].setAttribute("data-open", "0");
    }
  }

  function getThemeCatalogItems(panel) {
    return panel && panel.querySelectorAll ? panel.querySelectorAll(".lua-theme-catalog-item") : [];
  }

  function setThemeCatalogFocus(panel, item, shouldFocus) {
    var items = getThemeCatalogItems(panel);
    for (var i = 0; i < items.length; i += 1) {
      items[i].setAttribute("tabindex", items[i] === item ? "0" : "-1");
    }
    if (shouldFocus && item && typeof item.focus === "function") {
      try {
        item.focus();
      } catch (_ignoreThemeFocus) {}
    }
  }

  function applyThemeCatalogEntry(panel, item, themeName, persist, shouldFocus) {
    if (!themeName) {
      return;
    }
    setThemeEnabled(true, persist !== false);
    applyTheme(themeName, persist !== false);
    updateThemeCatalogSelection(state.activeTheme);
    setThemeCatalogFocus(panel, item, shouldFocus === true);
  }

  function ensureThemeCatalogDismissBinding() {
    if (state.themeCatalogDismissBound) {
      return;
    }
    state.themeCatalogDismissBound = true;
    document.addEventListener("mousedown", function (event) {
      var target = event && event.target;
      if (target && target.closest &&
          (target.closest(".lua-theme-catalog-panel") || target.closest(".lua-theme-catalog-trigger"))) {
        return;
      }
      hideThemeCatalogPanels();
    }, true);
  }

  function renderThemeCatalogPanel(panel, catalog) {
    if (!panel) {
      return;
    }

    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }

    var status = document.createElement("div");
    status.className = "lua-theme-catalog-status";
    panel.appendChild(status);

    if (!catalog || !catalog.themes || !catalog.themes.length) {
      status.textContent = state.themeCatalogLoading ? "Loading themes..." : "No theme catalog";
      return;
    }

    status.textContent = "Themes (" + catalog.themes.length + ")";
    var list = document.createElement("div");
    list.className = "lua-theme-catalog-list";
    var activeItem = null;

    for (var i = 0; i < catalog.themes.length; i += 1) {
      (function (entry, index) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "lua-theme-catalog-item";
        item.setAttribute("data-theme", String(entry.n || ""));
        item.setAttribute("data-active", String(entry.n || "") === state.activeTheme ? "1" : "0");
        item.setAttribute("data-index", String(index));
        item.setAttribute("tabindex", String(entry.n || "") === state.activeTheme ? "0" : "-1");

        var swatch = document.createElement("span");
        swatch.className = "lua-theme-catalog-swatch";
        swatch.style.background = String(entry.d || entry.p || "#58a6ff");

        var label = document.createElement("span");
        label.className = "lua-theme-catalog-label";
        label.textContent = normalizeThemeCatalogLabel(entry.l || entry.n || "Theme");

        item.appendChild(swatch);
        item.appendChild(label);
        item.addEventListener("mouseenter", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, false);
        }, true);
        item.addEventListener("focus", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, false);
        }, true);
        item.addEventListener("keydown", function (event) {
          var key = getEventKeyName(event);
          var delta = 0;
          if (key === "ArrowLeft") {
            delta = -1;
          } else if (key === "ArrowRight") {
            delta = 1;
          } else if (key === "ArrowUp") {
            delta = -3;
          } else if (key === "ArrowDown") {
            delta = 3;
          } else if (key === "Home") {
            delta = -9999;
          } else if (key === "End") {
            delta = 9999;
          } else if (key === "Escape") {
            hideThemeCatalogPanels();
            return;
          } else if (key === "Enter" || key === " ") {
            if (event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, true);
            return;
          } else {
            return;
          }

          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
          }
          var items = getThemeCatalogItems(panel);
          if (!items || !items.length) {
            return;
          }
          var current = index;
          var next = current + delta;
          if (delta === -9999) {
            next = 0;
          } else if (delta === 9999) {
            next = items.length - 1;
          }
          if (next < 0) {
            next = 0;
          }
          if (next >= items.length) {
            next = items.length - 1;
          }
          var target = items[next];
          if (target) {
            setThemeCatalogFocus(panel, target, true);
          }
        }, true);
        item.addEventListener("click", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, true);
          hideThemeCatalogPanels();
        }, true);
        if (String(entry.n || "") === state.activeTheme || !activeItem) {
          activeItem = item;
        }
        list.appendChild(item);
      })(catalog.themes[i], i);
    }

    panel.appendChild(list);
    if (activeItem) {
      setThemeCatalogFocus(panel, activeItem, false);
    }
  }

  function toggleThemeCatalogPanel(switcher, panelId) {
    if (!switcher) {
      return;
    }
    ensureThemeCatalogDismissBinding();
    var panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }
    var willOpen = String(panel.getAttribute("data-open") || "0") !== "1";
    hideThemeCatalogPanels();
    if (!willOpen) {
      return;
    }
    panel.setAttribute("data-open", "1");
    renderThemeCatalogPanel(panel, null);
    ensureThemeCatalogLoaded(function (catalog) {
      renderThemeCatalogPanel(panel, catalog);
      updateThemeCatalogSelection(state.activeTheme);
      var active = panel.querySelector(".lua-theme-catalog-item[data-active=\"1\"]") || panel.querySelector(".lua-theme-catalog-item");
      if (active) {
        setThemeCatalogFocus(panel, active, true);
      }
    });
  }

  function ensureThemeCatalogTrigger(switcher, baseId) {
    if (!switcher) {
      return;
    }

    var triggerId = baseId + "-catalog-trigger";
    var panelId = baseId + "-catalog-panel";
    var offButtonId = baseId + "-off";
    var trigger = document.getElementById(triggerId);
    var offButton = document.getElementById(offButtonId);
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.id = triggerId;
      trigger.className = "lua-theme-catalog-trigger";
      trigger.textContent = "...";
      trigger.setAttribute("title", "Themes");
      trigger.setAttribute("aria-label", "Themes");
      trigger.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        toggleThemeCatalogPanel(switcher, panelId);
      }, true);
    }

    if (trigger.parentNode !== switcher) {
      switcher.appendChild(trigger);
    }

    if (!offButton) {
      offButton = document.createElement("button");
      offButton.type = "button";
      offButton.id = offButtonId;
      offButton.className = "lua-theme-off-button";
      offButton.textContent = "Off";
      offButton.setAttribute("aria-label", "Theme off");
      offButton.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        hideThemeCatalogPanels();
        setThemeEnabled(false, true);
      }, true);
    }

    if (offButton.parentNode !== switcher) {
      switcher.appendChild(offButton);
    }

    var panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "lua-theme-catalog-panel";
      panel.setAttribute("data-open", "0");
    }
    if (panel.parentNode !== switcher) {
      switcher.appendChild(panel);
    }
  }

  function updateCaretToggleVisual() {
    var toggle = document.getElementById("ModUiToolbox-lua-caret-toggle");
    if (!toggle) {
      return;
    }
    toggle.setAttribute("data-on", state.caretHighlightEnabled ? "1" : "0");
    toggle.textContent = state.caretHighlightEnabled ? "Line HL On" : "Line HL Off";
  }

  function clearCaretLineHighlight(codeMirror) {
    if (!codeMirror) {
      return;
    }
    if (codeMirror.__luaProbeCaretLineHandle !== null &&
        typeof codeMirror.__luaProbeCaretLineHandle !== "undefined" &&
        typeof codeMirror.removeLineClass === "function") {
      try {
        codeMirror.removeLineClass(codeMirror.__luaProbeCaretLineHandle, "background", "lua-probe-caret-line");
      } catch (_ignore) {}
    }

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      if (wrapper && wrapper.querySelectorAll) {
        var nodes = wrapper.querySelectorAll(".lua-probe-caret-line");
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          if (node && node.classList && typeof node.classList.remove === "function") {
            node.classList.remove("lua-probe-caret-line");
          } else if (node && typeof node.className === "string") {
            node.className = node.className.replace(/\blua-probe-caret-line\b/g, "").replace(/\s+/g, " ").trim();
          }
        }
      }
    } catch (_ignoreDomClear) {}

    codeMirror.__luaProbeCaretLineHandle = null;
  }

  function updateCaretLineHighlight() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    clearCaretLineHighlight(codeMirror);

    if (state.switchInProgress) {
      return;
    }

    if (!state.caretHighlightEnabled ||
        typeof codeMirror.getCursor !== "function" ||
        typeof codeMirror.addLineClass !== "function") {
      return;
    }

    try {
      var cursor = codeMirror.getCursor();
      if (!cursor || typeof cursor.line !== "number") {
        return;
      }
      codeMirror.__luaProbeCaretLineHandle = codeMirror.addLineClass(cursor.line, "background", "lua-probe-caret-line");
    } catch (_ignore) {}
  }

  function setCaretHighlightEnabled(enabled, emitPacket) {
    state.caretHighlightEnabled = !!enabled;
    var persisted = saveCaretHighlightPreference(state.caretHighlightEnabled);
    updateCaretToggleVisual();
    updateCaretLineHighlight();

    if (emitPacket) {
      sendPacket("lua_caret_highlight_toggle", {
        enabled: state.caretHighlightEnabled,
        persisted: persisted
      });
    }
  }

  function detachCaretHighlightBindings(codeMirror) {
    if (!codeMirror) {
      return;
    }

    var handlers = codeMirror.__luaProbeCaretHandlers;
    if (handlers && typeof codeMirror.off === "function") {
      try {
        if (typeof handlers.cursorActivity === "function") {
          codeMirror.off("cursorActivity", handlers.cursorActivity);
        }
      } catch (_ignoreOffCursor) {}
      try {
        if (typeof handlers.scroll === "function") {
          codeMirror.off("scroll", handlers.scroll);
        }
      } catch (_ignoreOffScroll) {}
      try {
        if (typeof handlers.changes === "function") {
          codeMirror.off("changes", handlers.changes);
        }
      } catch (_ignoreOffChanges) {}
    }

    codeMirror.__luaProbeCaretHandlers = null;
    codeMirror.__luaProbeCaretBindingsBound = false;
    codeMirror.__luaProbeCaretBindingsOwner = "";
  }

  function ensureCaretHighlightBindings() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.on !== "function") {
      return;
    }

    if (state.caretBindingsCodeMirror && state.caretBindingsCodeMirror !== codeMirror) {
      detachCaretHighlightBindings(state.caretBindingsCodeMirror);
      state.caretBindingsCodeMirror = null;
    }

    var owner = String(codeMirror.__luaProbeCaretBindingsOwner || "");
    if ((owner && owner !== dumpId) || (!owner && codeMirror.__luaProbeCaretBindingsBound)) {
      detachCaretHighlightBindings(codeMirror);
    }

    if (String(codeMirror.__luaProbeCaretBindingsOwner || "") === dumpId && codeMirror.__luaProbeCaretHandlers) {
      state.caretBindingsCodeMirror = codeMirror;
      return;
    }

    var handlers = {};

    handlers.cursorActivity = function () {
      if (state.switchInProgress) {
        return;
      }
      syncCurrentContextKey();
      rememberTopLineForKey(state.lastContextKey);
      if (state.currentSnippetKey) {
        rememberTopLineForKey(state.currentSnippetKey);
      }
      updateCaretLineHighlight();
      if (!state.caretHighlightEnabled) {
        window.setTimeout(function () {
          if (!state.caretHighlightEnabled) {
            clearCaretLineHighlight(getLuaCodeMirror());
          }
        }, 0);
      }
    };

    handlers.scroll = function () {
      if (state.switchInProgress) {
        return;
      }
      syncCurrentContextKey();
      rememberTopLineForKey(state.lastContextKey);
      if (state.currentSnippetKey) {
        rememberTopLineForKey(state.currentSnippetKey);
      }
      if (!state.caretHighlightEnabled) {
        clearCaretLineHighlight(getLuaCodeMirror());
      }
    };

    handlers.changes = function () {
      window.setTimeout(function () {
        updateCaretLineHighlight();
        ensureLuaBufferSize();
      }, 0);
    };

    codeMirror.on("cursorActivity", handlers.cursorActivity);
    codeMirror.on("scroll", handlers.scroll);
    codeMirror.on("changes", handlers.changes);

    codeMirror.__luaProbeCaretHandlers = handlers;
    codeMirror.__luaProbeCaretBindingsBound = true;
    codeMirror.__luaProbeCaretBindingsOwner = dumpId;
    state.caretBindingsCodeMirror = codeMirror;
  }

  function ensureCaretHighlightToggle() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var fontSizeWrapper = root.querySelector(".header_editor .font_size_wrapper");
    if (!fontSizeWrapper) {
      return;
    }

    var toggle = document.getElementById("ModUiToolbox-lua-caret-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "ModUiToolbox-lua-caret-toggle";
      toggle.addEventListener("click", function () {
        setCaretHighlightEnabled(!state.caretHighlightEnabled, true);
      }, true);
    }

    if (toggle.parentNode !== fontSizeWrapper) {
      fontSizeWrapper.appendChild(toggle);
    }

    updateCaretToggleVisual();
    ensureCaretHighlightBindings();
    updateCaretLineHighlight();
    ensureLuaBufferSize();
  }

  function sendIdeSyncPacket(targetKind) {
    var normalizedTargetKind = normalizeIdeImportTargetKind(targetKind);
    var snapshot = typeof getCurrentIdeImportSnapshot === "function"
      ? getCurrentIdeImportSnapshot(normalizedTargetKind)
      : null;
    if (!snapshot || !snapshot.ready) {
      var blockedMessage = "Open Editor";
      if (snapshot && snapshot.status === "lua_editor_no_active_filter") {
        blockedMessage = "Select Filter";
      }
      flashIdeSyncButtonForTarget(
        normalizedTargetKind,
        blockedMessage,
        "#8a2424",
        "#ffffff",
        1400);
      return false;
    }
    if (normalizedTargetKind === "lua_editor") {
      state.lastIdeSyncContextKey = snapshot.contextKey || "";
      state.lastIdeSyncReference = cloneIdeSyncObject(snapshot.reference);
    }
    var code = typeof snapshot.code === "string" ? snapshot.code : "";
    var chunkSize = 8000;
    var total = Math.ceil(code.length / chunkSize) || 1;
    var syncId = "sync-" + Date.now();
    var codeHash32 = hashStringFNV1a(code);
    var reference = cloneIdeSyncObject(snapshot.reference);
    var exportedAtUtc = null;
    try {
      exportedAtUtc = new Date().toISOString();
    } catch (_ignoreExportedAtUtc) {}
    for (var i = 0; i < total; i += 1) {
      var chunk = code.substring(i * chunkSize, (i + 1) * chunkSize);
      sendPacket("lua_ide_sync", {
        syncId: syncId,
        part: i + 1,
        total: total,
        codeChunk: chunk,
        targetKind: normalizedTargetKind,
        contextKey: snapshot.contextKey || "",
        reference: reference,
        codeHash32: codeHash32,
        exportedAtUtc: exportedAtUtc
      });
    }
    return true;
  }

  function ensureIdeSyncButton() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    // Use the native font_size_wrapper container where the other buttons (like LINE HL OFF) live!
    var wrapper = root.querySelector(".header_editor .font_size_wrapper");
    if (!wrapper) {
      return;
    }

    var syncBtn = document.getElementById("ModUiToolbox-lua-ide-sync");
    if (!syncBtn) {
      syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.id = "ModUiToolbox-lua-ide-sync";
      syncBtn.textContent = "IDE Sync";

      syncBtn.addEventListener("click", function () {
        sendIdeSyncPacket("lua_editor");
      }, true);
    }

    if (syncBtn.parentNode !== wrapper) {
      wrapper.appendChild(syncBtn);
    }
  }

  function ensureScreenIdeSyncButton(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var wrapper = root.querySelector(".content .top_line .font_size_wrapper");
    if (!wrapper) {
      return;
    }

    var syncBtn = document.getElementById("ModUiToolbox-screen-ide-sync");
    if (!syncBtn) {
      syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.id = "ModUiToolbox-screen-ide-sync";
      syncBtn.textContent = "IDE Sync";

      syncBtn.addEventListener("click", function () {
        sendIdeSyncPacket("screen_editor");
      }, true);
    }

    if (syncBtn.parentNode !== wrapper) {
      wrapper.appendChild(syncBtn);
    }
  }

  function formatLuaBufferSize(count) {
    var n = typeof count === "number" && isFinite(count) ? count : 0;
    if (n < 0) {
      n = 0;
    }
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function parsePixelFontSize(value) {
    var text = String(value || "").trim();
    var parsed = parseFloat(text);
    return isFinite(parsed) ? parsed : 0;
  }

  function getCodeMirrorFontSizePx(codeMirror) {
    if (!codeMirror || typeof codeMirror.getWrapperElement !== "function") {
      return 0;
    }
    try {
      var wrapper = codeMirror.getWrapperElement();
      if (!wrapper) {
        return 0;
      }
      return parsePixelFontSize(window.getComputedStyle(wrapper, null).fontSize);
    } catch (_ignoreCodeMirrorFontSize) {}
    return 0;
  }

  function scheduleDelayed(fn, delayMs) {
    return window.setTimeout(fn, typeof delayMs === "number" ? delayMs : 0);
  }

  function saveLuaEditorViewPreferences() {
    var wrapNode = document.getElementById("lua_wrap_lines");
    persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "luaWrapLines", !!(wrapNode && wrapNode.checked));

    var fontSizePx = getCodeMirrorFontSizePx(getLuaCodeMirror());
    if (fontSizePx > 0) {
      persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "luaFontSizePx", fontSizePx);
    }
  }

  function restoreLuaEditorWrapLinesPreference() {
    var wrapNode = document.getElementById("lua_wrap_lines");
    if (!wrapNode) {
      return;
    }
    var wanted = !!getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "luaWrapLines",
      !!wrapNode.checked
    );
    if (!!wrapNode.checked === wanted) {
      return;
    }
    try {
      wrapNode.click();
    } catch (_ignoreWrapClick) {
      wrapNode.checked = wanted;
    }
  }

  function stepLuaEditorFontSizeToward(targetPx, remainingSteps) {
    if (!(targetPx > 0) || remainingSteps <= 0) {
      return;
    }
    var currentPx = getCodeMirrorFontSizePx(getLuaCodeMirror());
    if (!(currentPx > 0) || Math.abs(currentPx - targetPx) <= 0.35) {
      return;
    }
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }
    var selector = currentPx < targetPx
      ? '.header_editor .font_size_wrapper .lua_change_font_size[value="+"]'
      : '.header_editor .font_size_wrapper .lua_change_font_size[value="-"]';
    var button = root.querySelector(selector);
    if (!button) {
      return;
    }
    try {
      button.click();
    } catch (_ignoreFontClick) {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.changeFontSize === "function") {
        try {
          window.LUAEditorManager.changeFontSize(currentPx < targetPx);
        } catch (_ignoreFontManagerCall) {}
      }
    }
    scheduleDelayed(function () {
      stepLuaEditorFontSizeToward(targetPx, remainingSteps - 1);
    }, 60);
  }

  function restoreLuaEditorFontSizePreference() {
    var targetPx = getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "luaFontSizePx",
      0
    );
    if (!(targetPx > 0)) {
      return;
    }
    scheduleDelayed(function () {
      stepLuaEditorFontSizeToward(targetPx, 12);
    }, 0);
  }

  function ensureLuaEditorViewPreferenceBindings() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var wrapNode = document.getElementById("lua_wrap_lines");
    if (wrapNode && !wrapNode.__luaProbePreferenceBound) {
      wrapNode.__luaProbePreferenceBound = true;
      wrapNode.addEventListener("change", function () {
        saveLuaEditorViewPreferences();
      }, true);
    }

    var fontButtons = root.querySelectorAll('.header_editor .font_size_wrapper .lua_change_font_size');
    for (var i = 0; i < fontButtons.length; i += 1) {
      var button = fontButtons[i];
      if (!button || button.__luaProbePreferenceBound) {
        continue;
      }
      button.__luaProbePreferenceBound = true;
      button.addEventListener("click", function () {
        scheduleDelayed(function () {
          saveLuaEditorViewPreferences();
        }, 80);
      }, true);
    }
  }

  function restoreLuaEditorViewPreferences() {
    ensureLuaEditorViewPreferenceBindings();
    restoreLuaEditorWrapLinesPreference();
    restoreLuaEditorFontSizePreference();
    scheduleDelayed(function () {
      saveLuaEditorViewPreferences();
    }, 120);
  }

  function saveScreenEditorViewPreferences(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrapRead) {}
    persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "screenWrapLines", !!(wrapNode && wrapNode.checked));

    var fontSizePx = getCodeMirrorFontSizePx(getScreenEditorCodeMirror(root));
    if (!(fontSizePx > 0)) {
      try {
        var codeNode = getScreenEditorCodeNode(getScreenEditorPanel(), root);
        if (codeNode) {
          fontSizePx = parsePixelFontSize(window.getComputedStyle(codeNode, null).fontSize);
        }
      } catch (_ignoreScreenFontNode) {}
    }
    if (fontSizePx > 0) {
      persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "screenFontSizePx", fontSizePx);
    }
  }

  function restoreScreenEditorWrapLinesPreference(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrap) {}
    if (!wrapNode) {
      return;
    }
    var wanted = !!getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "screenWrapLines",
      !!wrapNode.checked
    );
    if (!!wrapNode.checked === wanted) {
      return;
    }
    try {
      wrapNode.click();
    } catch (_ignoreScreenWrapClick) {
      wrapNode.checked = wanted;
    }
  }

  function stepScreenEditorFontSizeToward(root, targetPx, remainingSteps) {
    if (!root || !(targetPx > 0) || remainingSteps <= 0) {
      return;
    }
    var currentPx = getCodeMirrorFontSizePx(getScreenEditorCodeMirror(root));
    if (!(currentPx > 0)) {
      try {
        var codeNode = getScreenEditorCodeNode(getScreenEditorPanel(), root);
        if (codeNode) {
          currentPx = parsePixelFontSize(window.getComputedStyle(codeNode, null).fontSize);
        }
      } catch (_ignoreScreenCurrentFont) {}
    }
    if (!(currentPx > 0) || Math.abs(currentPx - targetPx) <= 0.35) {
      return;
    }
    var selector = currentPx < targetPx
      ? '.font_size_wrapper .lua_change_font_size[value="+"]'
      : '.font_size_wrapper .lua_change_font_size[value="-"]';
    var button = root.querySelector(selector);
    if (!button) {
      return;
    }
    try {
      button.click();
    } catch (_ignoreScreenFontClick) {}
    scheduleDelayed(function () {
      stepScreenEditorFontSizeToward(root, targetPx, remainingSteps - 1);
    }, 60);
  }

  function restoreScreenEditorFontSizePreference(root) {
    var targetPx = getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "screenFontSizePx",
      0
    );
    if (!(targetPx > 0)) {
      return;
    }
    scheduleDelayed(function () {
      stepScreenEditorFontSizeToward(root, targetPx, 12);
    }, 0);
  }

  function ensureScreenEditorViewPreferenceBindings(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrapBind) {}
    if (wrapNode && !wrapNode.__luaProbePreferenceBound) {
      wrapNode.__luaProbePreferenceBound = true;
      wrapNode.addEventListener("change", function () {
        saveScreenEditorViewPreferences(root);
      }, true);
    }

    var buttons = root.querySelectorAll('.font_size_wrapper .lua_change_font_size');
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      if (!button || button.__luaProbePreferenceBound) {
        continue;
      }
      button.__luaProbePreferenceBound = true;
      button.addEventListener("click", function () {
        scheduleDelayed(function () {
          saveScreenEditorViewPreferences(root);
        }, 80);
      }, true);
    }
  }

  function restoreScreenEditorViewPreferences(root) {
    ensureScreenEditorViewPreferenceBindings(root);
    restoreScreenEditorWrapLinesPreference(root);
    restoreScreenEditorFontSizePreference(root);
    scheduleDelayed(function () {
      saveScreenEditorViewPreferences(root);
    }, 120);
  }

  function ensureLuaBufferSize() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var reportNode = root.querySelector(".error_ctn .header .lua_error_header_wrapper");
    if (!reportNode) {
      return;
    }

    var sizeNode = document.getElementById("ModUiToolbox-lua-buffer-size");
    if (!sizeNode) {
      sizeNode = document.createElement("span");
      sizeNode.id = "ModUiToolbox-lua-buffer-size";
      sizeNode.className = "lua-probe-buffer-size";
    }

    var titleTextNode = document.getElementById("ModUiToolbox-lua-title-text");
    var titleNode = document.getElementById("lua_editor_title") ||
      root.querySelector(".editor_header .title, .editor_header .header_bar .title");
    if (titleNode && titleTextNode && titleTextNode.parentNode === titleNode) {
      titleNode.textContent = String(titleTextNode.textContent || titleNode.getAttribute("data-probe-title") || "").replace(/\s+/g, " ").trim();
      titleNode.removeAttribute("data-probe-title");
    }
    if (titleTextNode && titleTextNode.parentNode) {
      titleTextNode.parentNode.removeChild(titleTextNode);
    }

    if (sizeNode.parentNode !== reportNode) {
      reportNode.appendChild(sizeNode);
    }

    var code = "";
    var codeMirror = getLuaCodeMirror();
    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = String(codeMirror.getValue() || "");
      } else {
        var textArea = document.getElementById("editor_window");
        code = textArea && typeof textArea.value === "string" ? textArea.value : "";
      }
    } catch (_ignoreLuaBufferSize) {}

    sizeNode.textContent = "Code: " + formatLuaBufferSize(code.length) + " chars";
    sizeNode.setAttribute("data-count", String(code.length));
  }

  function getDefaultThemeName() {
    return "daisy-black";
  }

  function getThemeDotShortcuts() {
    return [
      { name: "daisy-black", label: "Black", dot: "#a6e22e" },
      { name: "daisy-emerald", label: "Emerald", dot: "#6ee7b7" },
      { name: "daisy-smooth", label: "Smooth", dot: "#ff9f43" }
    ];
  }

  function createThemeDotSwitcher(switcherId) {
    var switcher = document.createElement("div");
    switcher.id = switcherId;
    switcher.className = "modui-theme-switcher";

    var shortcuts = getThemeDotShortcuts();
    for (var i = 0; i < shortcuts.length; i += 1) {
      (function (shortcut) {
        var theme = getThemeByName(shortcut.name) || shortcut;
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "lua-theme-dot";
        dot.style.background = shortcut.dot || theme.dot;
        dot.setAttribute("data-theme", shortcut.name);
        dot.setAttribute("data-active", "0");
        dot.setAttribute("title", "Theme: " + (theme.label || shortcut.label || shortcut.name));
        dot.setAttribute("aria-label", "Theme: " + (theme.label || shortcut.label || shortcut.name));
        dot.addEventListener("click", function () {
          setThemeEnabled(true, true);
          applyTheme(shortcut.name, true);
        }, true);
        switcher.appendChild(dot);
      })(shortcuts[i]);
    }

    return switcher;
  }

  function ensureSharedThemeSwitcher(hostNode, switcherId, applyActiveTheme) {
    var resolvedHost = hostNode || null;
    var resolvedId = String(switcherId || "").trim();
    var switcher;
    if (!resolvedHost || typeof resolvedHost.appendChild !== "function" || !resolvedId) {
      return null;
    }

    switcher = document.getElementById(resolvedId);
    if (!switcher) {
      switcher = createThemeDotSwitcher(resolvedId);
    }

    if (switcher.parentNode !== resolvedHost) {
      resolvedHost.appendChild(switcher);
    }

    ensureThemeCatalogTrigger(switcher, resolvedId);
    updateThemeDotSelection(state.activeTheme || getDefaultThemeName());
    updateThemeCatalogSelection(state.activeTheme || getDefaultThemeName());
    updateThemeOffButtonSelection();
    if (applyActiveTheme !== false) {
      applyTheme(state.activeTheme || getDefaultThemeName(), false);
    }
    return switcher;
  }

  function getThemeRoots() {
    var roots = [];
    var bodyRoot = document.body || null;
    var luaRoot = document.getElementById("dpu_editor");
    var screenRoot = getScreenEditorRoot();
    var globalMenuRoot = getGlobalMenuThemeRoot();
    var inventoryRoot = getInventoryThemeRoot();
    var extraRoots = document.querySelectorAll("[data-modui-theme-target=\"1\"]");
    function pushRoot(node) {
      if (!node || !node.style || typeof node.style.setProperty !== "function") {
        return;
      }
      if (roots.indexOf(node) >= 0) {
        return;
      }
      roots.push(node);
    }
    if (bodyRoot) {
      pushRoot(bodyRoot);
    }
    if (luaRoot) {
      pushRoot(luaRoot);
    }
    if (screenRoot && screenRoot !== luaRoot) {
      pushRoot(screenRoot);
    }
    if (globalMenuRoot) {
      pushRoot(globalMenuRoot);
    }
    if (inventoryRoot) {
      pushRoot(inventoryRoot);
    }
    if (extraRoots && typeof extraRoots.length === "number") {
      for (var i = 0; i < extraRoots.length; i += 1) {
        pushRoot(extraRoots[i]);
      }
    }
    return roots;
  }

  function applyThemeToRoot(root, theme) {
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return;
    }
    var isLight = !!(theme && theme.isLight);
    try {
      root.setAttribute("data-lua-probe-theme-light", isLight ? "1" : "0");
    } catch (_ignoreThemeLightAttr) {}
    root.style.setProperty("--lua-probe-theme-is-light", isLight ? "1" : "0");
    root.style.setProperty("--lua-probe-accent", theme.accent);
    root.style.setProperty("--lua-probe-header-bg", theme.header);
    root.style.setProperty("--lua-probe-caret-line-bg", theme.caretBg);
    root.style.setProperty("--lua-probe-accent-solid", theme.accentSolid);
    root.style.setProperty("--lua-probe-on-accent", theme.onAccent);
    root.style.setProperty("--lua-probe-surface-main", theme.surfaceMain);
    root.style.setProperty("--lua-probe-surface-elevated", theme.surfaceElevated);
    root.style.setProperty("--lua-probe-surface-backdrop", theme.surfaceBackdrop || theme.surfaceMain);
    root.style.setProperty("--lua-probe-surface-row", theme.surfaceRow);
    root.style.setProperty("--lua-probe-surface-deep", theme.surfaceDeep);
    root.style.setProperty("--lua-probe-surface-row-alt", theme.surfaceRowAlt);
    root.style.setProperty("--lua-probe-border-strong", theme.borderStrong);
    root.style.setProperty("--lua-probe-border-hover", theme.borderHover);
    root.style.setProperty("--lua-probe-selection-border", theme.selectionBorder || theme.accent);
    root.style.setProperty("--lua-probe-shadow", theme.shadow);
    root.style.setProperty("--lua-probe-text-main", theme.cmText || theme.textMuted);
    root.style.setProperty("--lua-probe-text-muted", theme.textMuted);
    root.style.setProperty("--lua-probe-text-dim", theme.textDim);
    root.style.setProperty("--lua-probe-cm-text", theme.cmText || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-comment", theme.cmComment);
    root.style.setProperty("--lua-probe-cm-linenumber", theme.cmLineNumber);
    root.style.setProperty("--lua-probe-cm-keyword", theme.cmKeyword || theme.accentSolid);
    root.style.setProperty("--lua-probe-cm-atom", theme.cmAtom || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-string", theme.cmString || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-number", theme.cmNumber || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-def", theme.cmDef || theme.accentSolid);
    root.style.setProperty("--lua-probe-cm-builtin", theme.cmBuiltin || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-variable", theme.cmVariable || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-variable-2", theme.cmVariable2 || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-operator", theme.cmOperator || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-property", theme.cmProperty || theme.accentSolid);
    root.style.setProperty("--lua-probe-gutter-border", theme.gutterBorder);
    root.style.setProperty("--lua-probe-btn-apply-bg", theme.btnApplyBg);
    root.style.setProperty("--lua-probe-btn-apply-border", theme.btnApplyBorder);
    root.style.setProperty("--lua-probe-btn-apply-color", theme.btnApplyColor);
    root.style.setProperty("--lua-probe-btn-apply-hover-bg", theme.btnApplyHoverBg);
    root.style.setProperty("--lua-probe-btn-apply-active-bg", theme.btnApplyActiveBg);
    root.style.setProperty("--lua-probe-warning", theme.warning || "#d7b24a");
    root.style.setProperty("--lua-probe-mode-selected-bg", theme.modeSelectedBg || theme.btnApplyBg);
    root.style.setProperty("--lua-probe-mode-selected-border", theme.modeSelectedBorder || theme.btnApplyBorder);
    root.style.setProperty("--lua-probe-mode-selected-color", theme.modeSelectedColor || theme.btnApplyColor);
    root.style.setProperty("--lua-probe-btn-cancel-bg", theme.btnCancelBg);
    root.style.setProperty("--lua-probe-btn-cancel-border", theme.btnCancelBorder);
    root.style.setProperty("--lua-probe-btn-cancel-color", theme.btnCancelColor);
    root.style.setProperty("--lua-probe-btn-cancel-hover-bg", theme.btnCancelHoverBg);
    root.style.setProperty("--lua-probe-btn-cancel-active-bg", theme.btnCancelActiveBg);
    root.style.setProperty("--lua-probe-btn-disabled-bg", theme.btnDisabledBg || theme.btnCancelBg);
    root.style.setProperty("--lua-probe-btn-disabled-border", theme.btnDisabledBorder || theme.btnCancelBorder);
    root.style.setProperty("--lua-probe-btn-disabled-color", theme.btnDisabledColor || theme.textDim);
  }

  function applyTheme(themeName, emitPacket) {
    var wanted = normalizeLegacyThemeName(themeName || getDefaultThemeName());
    var theme = getThemeByName(wanted);
    if (!theme) {
      state.activeTheme = wanted;
      saveThemePreference(wanted);
      ensureThemeCatalogLoaded(function (catalog) {
        var resolved = findCompactThemeByName(wanted);
        if (resolved) {
          applyTheme(wanted, emitPacket);
          return;
        }
        applyTheme(getDefaultThemeName(), emitPacket);
      });
      return false;
    }
    var roots = getThemeRoots();
    state.activeTheme = theme.name;
    saveThemePreference(theme.name);
    for (var i = 0; i < roots.length; i += 1) {
      applyThemeToRoot(roots[i], theme);
    }
    ensureInventoryThemeStyle();
    ensureInventoryInspectorEnhancer(document);
    applyInlineThemeToVisibleItemInspectors(document);
    state.lastAppliedTheme = theme.name;
    syncEditorThemeActivation();
    updateThemeDotSelection(theme.name);
    updateThemeCatalogSelection(theme.name);
    updateThemeOffButtonSelection();

    if (emitPacket) {
      sendPacket("lua_theme_changed", {
        theme: theme.name,
        label: theme.label,
        isLight: !!theme.isLight,
        accent: theme.accent,
        header: theme.header,
        caretBg: theme.caretBg,
        surfaceMain: theme.surfaceMain
      });
    }
    return true;
  }

  function ensureThemeSwitcher() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var header = root.querySelector(".editor_header .header_container");
    if (!header) {
      return;
    }

    ensureSharedThemeSwitcher(header, "ModUiToolbox-lua-theme-dots", false);
    ensureLuaBufferSize();
    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }

  function ensureInventoryThemeSwitcher() {
    var root = getInventoryThemeRoot();
    var host;
    if (!root || !root.querySelector || !isElementVisible(root)) {
      return;
    }

    host = root.querySelector(".navigation_inputs_wrapper");
    if (!host) {
      host = root.querySelector(".container_header");
    }
    if (!host) {
      return;
    }

    ensureSharedThemeSwitcher(host, "ModUiToolbox-inventory-theme-dots", false);
  }

  function getInventoryInspectorCollapsed(inspector) {
    var attrValue;
    if (inspector && typeof inspector.getAttribute === "function") {
      attrValue = inspector.getAttribute("data-modui-inventory-inspector-collapsed");
      if (attrValue === "1") {
        return true;
      }
      if (attrValue === "0") {
        return false;
      }
    }
    return !!state.inventoryInspectorCollapsed;
  }

  function getInventoryInspectorHost(node) {
    if (!node || !node.closest) {
      return null;
    }
    return node.closest(".selected_item_inspector_wrapper, .basic_window.item_inspector_win");
  }

  function setInventoryInspectorCollapsed(inspector, collapsed) {
    var nextValue = !!collapsed;
    state.inventoryInspectorCollapsed = nextValue;
    if (inspector && typeof inspector.setAttribute === "function") {
      inspector.setAttribute("data-modui-inventory-inspector-collapsed", nextValue ? "1" : "0");
    }
    return nextValue;
  }

  function updateInventoryInspectorSummary(inspector, summary) {
    var title;
    var toggle;
    var titleNode;
    var collapsed;
    if (!inspector || !summary || !summary.querySelector) {
      return;
    }

    title = summary.querySelector(".modui-inventory-inspector-summary-title");
    toggle = summary.querySelector(".modui-inventory-inspector-toggle");
    titleNode = inspector.querySelector(".header_wrapper .item_longname") || inspector.querySelector(".item_longname");
    collapsed = getInventoryInspectorCollapsed(inspector);

    if (title) {
      title.textContent = titleNode ? String(titleNode.textContent || "").trim() : "Item";
    }
    if (toggle) {
      toggle.textContent = collapsed ? "▾" : "▴";
      toggle.setAttribute("aria-label", collapsed ? "Expand item preview" : "Collapse item preview");
      toggle.setAttribute("title", collapsed ? "Expand item preview" : "Collapse item preview");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    setInventoryInspectorCollapsed(inspector, collapsed);
  }

  function applyInventoryInspectorInlineTheme(inspector) {
    var labelNodes;
    var resolvedMain;
    var resolvedDim;
    var stringNodes;
    var i;
    if (!inspector || !inspector.querySelectorAll) {
      return;
    }

    try {
      var inspectorStyle = window.getComputedStyle(inspector);
      resolvedMain = String(inspectorStyle.getPropertyValue("--lua-probe-text-main") || "").trim()
        || String(inspectorStyle.getPropertyValue("--lua-probe-cm-text") || "").trim()
        || String(inspectorStyle.getPropertyValue("--lua-probe-text-muted") || "").trim()
        || "rgb(51, 60, 77)";
      resolvedDim = String(inspectorStyle.getPropertyValue("--lua-probe-text-dim") || "").trim()
        || String(inspectorStyle.getPropertyValue("--lua-probe-text-muted") || "").trim()
        || "rgb(36, 42, 54)";
    } catch (_ignoreInventoryInspectorInlineThemeTokens) {
      resolvedMain = "rgb(51, 60, 77)";
      resolvedDim = "rgb(36, 42, 54)";
    }

    labelNodes = inspector.querySelectorAll(".drilldownElementBody .label, .drilldownElementBody .element_label");
    for (i = 0; i < labelNodes.length; i += 1) {
      var labelNode = labelNodes[i];
      if (!labelNode.style || typeof labelNode.style.setProperty !== "function") {
        continue;
      }
      labelNode.style.setProperty("color", resolvedMain, "important");
      labelNode.style.setProperty("-webkit-text-fill-color", resolvedMain, "important");
    }

    stringNodes = inspector.querySelectorAll(".drilldownElementBody .string");
    for (i = 0; i < stringNodes.length; i += 1) {
      var stringNode = stringNodes[i];
      if (!stringNode.style || typeof stringNode.style.setProperty !== "function") {
        continue;
      }
      stringNode.style.setProperty("color", resolvedDim, "important");
      stringNode.style.setProperty("-webkit-text-fill-color", resolvedDim, "important");
    }

    stringNodes = inspector.querySelectorAll(".drilldown_element_talent .talent_groups_name_label");
    for (i = 0; i < stringNodes.length; i += 1) {
      var talentGroupNode = stringNodes[i];
      if (!talentGroupNode.style || typeof talentGroupNode.style.setProperty !== "function") {
        continue;
      }
      talentGroupNode.style.setProperty("color", resolvedDim, "important");
      talentGroupNode.style.setProperty("-webkit-text-fill-color", resolvedDim, "important");
    }
  }

  function applyInlineThemeToVisibleItemInspectors(root) {
    var scopeRoot = root && root.querySelectorAll ? root : document;
    var inspectors;
    var i;
    if (!scopeRoot || !scopeRoot.querySelectorAll) {
      return;
    }

    inspectors = scopeRoot.querySelectorAll(".item_inspector_wrapper");
    for (i = 0; i < inspectors.length; i += 1) {
      if (!isElementVisible(inspectors[i])) {
        continue;
      }
      applyInventoryInspectorInlineTheme(inspectors[i]);
    }
  }

  function disconnectInventoryThemeObserver() {
    try {
      if (state.inventoryThemeObserver && typeof state.inventoryThemeObserver.disconnect === "function") {
        state.inventoryThemeObserver.disconnect();
      }
    } catch (_ignoreInventoryThemeObserverDisconnect) {}
    state.inventoryThemeObserver = null;
    state.inventoryThemeObserverRoot = null;
  }

  function isInventoryThemeMutationRelevant(mutation) {
    var target;
    var attrName;
    if (!mutation || state.inventoryThemeApplying || Date.now() < (state.inventoryThemeIgnoreMutationsUntil || 0)) {
      return false;
    }

    if (mutation.type === "attributes") {
      target = mutation.target || null;
      attrName = String(mutation.attributeName || "");
      if (attrName.indexOf("data-modui-") === 0) {
        return false;
      }
      if (target && target.closest && target.closest(".modui-inventory-inspector-summary, .modui-inventory-inspector-top-panel")) {
        return false;
      }
      return true;
    }

    return !!(
      (mutation.addedNodes && mutation.addedNodes.length) ||
      (mutation.removedNodes && mutation.removedNodes.length)
    );
  }

  function ensureInventoryThemeObserver(root) {
    var observer;
    if (!root || !window.MutationObserver) {
      return;
    }

    if (state.inventoryThemeObserver && state.inventoryThemeObserverRoot === root) {
      return;
    }

    disconnectInventoryThemeObserver();

    observer = new MutationObserver(function (mutations) {
      var i;
      if (!mutations || state.inventoryThemeApplying) {
        return;
      }
      for (i = 0; i < mutations.length; i += 1) {
        if (!isInventoryThemeMutationRelevant(mutations[i])) {
          continue;
        }
        state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
        applyInlineThemeToVisibleItemInspectors(document);
        state.inventoryThemeDirty = true;
        return;
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true
    });

    state.inventoryThemeObserver = observer;
    state.inventoryThemeObserverRoot = root;
  }

  function bindInventoryInspectorToggle(toggle) {
    if (!toggle || toggle.__moduiInventoryToggleBound) {
      return;
    }

    toggle.__moduiInventoryToggleBound = true;
    toggle.addEventListener("click", function (event) {
      var inspector;
      var summary;
      var collapsed;
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }

      inspector = getInventoryInspectorHost(toggle);
      collapsed = !getInventoryInspectorCollapsed(inspector);
      setInventoryInspectorCollapsed(inspector, collapsed);
      summary = inspector ? inspector.querySelector(".modui-inventory-inspector-summary") : null;
      if (inspector && summary) {
        updateInventoryInspectorSummary(inspector, summary);
      }
    });
  }

  function resetInventoryInspectorWrapper(wrapper) {
    var header;
    var content;
    var info;
    var restore;
    var description;
    var summary;
    var topPanel;
    var buttonHost;
    var themedNodes;
    var j;
    if (!wrapper || !wrapper.querySelectorAll) {
      return;
    }

    header = wrapper.querySelector(".header_wrapper");
    content = wrapper.querySelector(".content_wrapper");
    info = wrapper.querySelector(".item_informations_wrapper");
    restore = wrapper.querySelector(".item_restore_count");
    description = wrapper.querySelector(".item_description_wrapper");
    summary = wrapper.querySelector(".modui-inventory-inspector-summary");
    topPanel = wrapper.querySelector(".modui-inventory-inspector-top-panel");
    buttonHost = wrapper.querySelector(".item_inspector_button_wrapper");
    themedNodes = wrapper.querySelectorAll(".drilldownElementBody .label, .drilldownElementBody .element_label, .drilldownElementBody .string");

    if (content) {
      if (restore && restore.parentNode !== content) {
        content.insertBefore(restore, info || null);
      }
      if (description && description.parentNode !== content) {
        content.insertBefore(description, info || null);
      }
    }
    if (header && content && header.parentNode !== wrapper) {
      wrapper.insertBefore(header, content);
    }
    if (buttonHost && header && buttonHost.parentNode !== header) {
      header.appendChild(buttonHost);
    }
    if (topPanel && topPanel.parentNode) {
      topPanel.parentNode.removeChild(topPanel);
    }
    if (summary && summary.parentNode) {
      summary.parentNode.removeChild(summary);
    }
    for (j = 0; j < themedNodes.length; j += 1) {
      var themedNode = themedNodes[j];
      if (!themedNode.style || typeof themedNode.style.removeProperty !== "function") {
        continue;
      }
      themedNode.style.removeProperty("color");
      themedNode.style.removeProperty("-webkit-text-fill-color");
    }
  }

  function teardownInventoryInspectorEnhancer(root) {
    var wrappers;
    var i;
    if (!root || !root.querySelectorAll) {
      return;
    }

    wrappers = root.querySelectorAll(".selected_item_inspector_wrapper .item_inspector_wrapper, .basic_window.item_inspector_win .item_inspector_wrapper");
    for (i = 0; i < wrappers.length; i += 1) {
      resetInventoryInspectorWrapper(wrappers[i]);
    }
  }

  function hasEnhanceableInventoryInspectorContent(inspector, wrapper, content, info) {
    var titleNode;
    var titleText;
    var errorNode;
    if (!inspector || !wrapper || !content || !info) {
      return false;
    }
    titleNode = inspector.querySelector(".header_wrapper .item_longname") || inspector.querySelector(".item_longname");
    titleText = titleNode ? String(titleNode.textContent || "").trim() : "";
    if (titleText) {
      return true;
    }
    errorNode = inspector.querySelector(".item_inspector_error_wrapper");
    if (errorNode && isElementVisible(errorNode) && /no item currently selected/i.test(String(errorNode.textContent || ""))) {
      return false;
    }
    return false;
  }

  function ensureInventoryInspectorEnhancer(root) {
    var inspectors;
    var i;
    if (!root || !root.querySelectorAll) {
      return;
    }

    inspectors = root.querySelectorAll(".selected_item_inspector_wrapper, .basic_window.item_inspector_win");
    for (i = 0; i < inspectors.length; i += 1) {
      var inspector = inspectors[i];
      var wrapper;
      var header;
      var content;
      var info;
      var restore;
      var description;
      var summary;
      var actions;
      var toggle;
      var buttonHost;
      var topPanel;

      if (!isElementVisible(inspector) || !inspector.querySelector) {
        continue;
      }

      state.inventoryInspectorCollapsed = getInventoryInspectorCollapsed(inspector);

      wrapper = inspector.classList && inspector.classList.contains("item_inspector_win")
        ? inspector.querySelector(".item_inspector_wrapper")
        : inspector.querySelector(".item_inspector_wrapper");
      header = wrapper ? wrapper.querySelector(".header_wrapper") : null;
      content = wrapper ? wrapper.querySelector(".content_wrapper") : null;
      info = content ? content.querySelector(".item_informations_wrapper") : null;
      if (!wrapper || !header || !content || !info) {
        continue;
      }
      if (!hasEnhanceableInventoryInspectorContent(inspector, wrapper, content, info)) {
        resetInventoryInspectorWrapper(wrapper);
        continue;
      }

      restore = wrapper.querySelector(".item_restore_count") || content.querySelector(".item_restore_count");
      description = wrapper.querySelector(".item_description_wrapper") || content.querySelector(".item_description_wrapper");
      summary = wrapper.querySelector(".modui-inventory-inspector-summary");
      if (!summary) {
        summary = document.createElement("div");
        summary.className = "modui-inventory-inspector-summary";

        var title = document.createElement("div");
        title.className = "modui-inventory-inspector-summary-title";
        summary.appendChild(title);

        actions = document.createElement("div");
        actions.className = "modui-inventory-inspector-summary-actions";

        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "modui-inventory-inspector-toggle";

        actions.appendChild(toggle);
        summary.appendChild(actions);
        wrapper.insertBefore(summary, wrapper.firstChild);
      }

      actions = summary.querySelector(".modui-inventory-inspector-summary-actions");
      toggle = summary.querySelector(".modui-inventory-inspector-toggle");
      bindInventoryInspectorToggle(toggle);
      buttonHost = wrapper.querySelector(".item_inspector_button_wrapper");
      if (actions && buttonHost && buttonHost.parentNode !== actions) {
        actions.insertBefore(buttonHost, toggle || null);
      }

      topPanel = wrapper.querySelector(".modui-inventory-inspector-top-panel");
      if (!topPanel) {
        topPanel = document.createElement("div");
        topPanel.className = "modui-inventory-inspector-top-panel";
        wrapper.insertBefore(topPanel, content);
      }

      if (header.parentNode !== topPanel) {
        topPanel.appendChild(header);
      }
      if (restore && restore.parentNode !== topPanel) {
        topPanel.appendChild(restore);
      }
      if (description && description.parentNode !== topPanel) {
        topPanel.appendChild(description);
      }
      if (info.parentNode !== content) {
        content.appendChild(info);
      }

      updateInventoryInspectorSummary(inspector, summary);
      applyInventoryInspectorInlineTheme(inspector);
    }
  }

  function ensureInventoryThemeRoot() {
    var root = getInventoryThemeRoot();
    var themeName = state.activeTheme || getDefaultThemeName();
    var theme = getThemeByName(themeName);
    var themeEnabled = !!state.themeEnabled;
    var rootVisible = !!root && isElementVisible(root);
    var rootChanged = state.inventoryThemeRootNode !== root;
    var themeChanged;
    var needsRefresh;
    if (!rootVisible) {
      disconnectInventoryThemeObserver();
      if (state.inventoryThemeRootNode && state.inventoryThemeRootNode.querySelector) {
        teardownInventoryInspectorEnhancer(state.inventoryThemeRootNode);
      }
      state.inventoryThemeRootNode = null;
      state.inventoryThemeRootVisible = false;
      state.inventoryThemeAppliedTheme = "";
      state.inventoryThemeAppliedEnabled = null;
      state.inventoryThemeDirty = true;
      state.inventoryThemeApplying = false;
      setInventoryHudLightActive(false, null);
      return;
    }

    if (state.inventoryThemeRootNode && state.inventoryThemeRootNode !== root && state.inventoryThemeRootNode.querySelector) {
      teardownInventoryInspectorEnhancer(state.inventoryThemeRootNode);
    }
    if (rootChanged) {
      disconnectInventoryThemeObserver();
      state.inventoryThemeDirty = true;
    }

    ensureInventoryThemeObserver(root);

    themeChanged = state.inventoryThemeAppliedTheme !== themeName ||
      state.inventoryThemeAppliedEnabled !== themeEnabled;
    needsRefresh = rootChanged || themeChanged || !!state.inventoryThemeDirty;

    state.inventoryThemeRootNode = root;
    state.inventoryThemeRootVisible = true;

    if (!needsRefresh) {
      return;
    }

    state.inventoryThemeApplying = true;
    try {
      state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
      ensureInventoryThemeStyle();
      ensureInventoryThemeSwitcher();
      refreshInventoryThemeAnnotations(root);
      setInventoryHudLightActive(themeEnabled && !!theme && !!theme.isLight, root);
      setThemeRootActive(root, themeEnabled && rootVisible);
      if (themeEnabled) {
        ensureInventoryInspectorEnhancer(document);
      } else {
        teardownInventoryInspectorEnhancer(document);
      }

      state.inventoryThemeAppliedTheme = themeName;
      state.inventoryThemeAppliedEnabled = themeEnabled;
      if (rootChanged || themeChanged) {
        applyTheme(themeName, false);
      }
    } finally {
      state.inventoryThemeApplying = false;
      state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
      state.inventoryThemeDirty = false;
    }
  }

  function ensureScreenThemeSwitcher(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var header = root.querySelector(".header_block");
    if (!header) {
      return;
    }

    ensureSharedThemeSwitcher(header, "ModUiToolbox-screen-theme-dots", false);
  }

  function ensureScreenBufferSize(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var reportNode = root.querySelector(".footer_line .error_block .error_header .left_wrapper");
    if (!reportNode) {
      return;
    }

    var sizeNode = document.getElementById("ModUiToolbox-screen-buffer-size");
    if (!sizeNode) {
      sizeNode = document.createElement("span");
      sizeNode.id = "ModUiToolbox-screen-buffer-size";
      sizeNode.className = "lua-probe-screen-buffer-size";
    }

    if (sizeNode.parentNode !== reportNode) {
      reportNode.appendChild(sizeNode);
    }

    var code = "";
    var codeMirror = typeof getScreenEditorCodeMirror === "function" ? getScreenEditorCodeMirror(root) : null;
    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = String(codeMirror.getValue() || "");
      }
    } catch (_ignoreScreenBufferSize) {}

    if (!code) {
      try {
        var countNode = root.querySelector(".character_count");
        var match = countNode ? String(countNode.textContent || "").match(/^\s*(\d+)/) : null;
        if (match) {
          sizeNode.textContent = "Code: " + formatLuaBufferSize(parseInt(match[1], 10) || 0) + " chars";
          return;
        }
      } catch (_ignoreScreenCountNode) {}
    }

    sizeNode.textContent = "Code: " + formatLuaBufferSize(code.length) + " chars";
  }

  function ensureScreenEditorFacelift() {
    var root = getScreenEditorRoot();
    if (!root || !root.querySelector) {
      try {
        if (state.screenEditorVisible && state.lastScreenContextKey) {
          rememberScreenEditorViewportForKey(state.lastScreenContextKey);
        }
      } catch (_ignoreScreenRememberOnMissingRoot) {}
      try {
        if (state.screenViewportBindingsCodeMirror) {
          detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
          state.screenViewportBindingsCodeMirror = null;
        }
      } catch (_ignoreScreenBindingsOnMissingRoot) {}
      state.screenEditorVisible = false;
      state.screenLastRestoredContextKey = "";
      state.screenPreferenceRestoreContextKey = "";
      return;
    }

    if (!isElementVisible(root)) {
      try {
        if (state.screenEditorVisible && state.lastScreenContextKey) {
          rememberScreenEditorViewportForKey(state.lastScreenContextKey);
        }
      } catch (_ignoreScreenRememberOnHide) {}
      try {
        if (state.screenViewportBindingsCodeMirror) {
          detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
          state.screenViewportBindingsCodeMirror = null;
        }
      } catch (_ignoreScreenBindingsOnHide) {}
      state.screenEditorVisible = false;
      state.screenLastRestoredContextKey = "";
      state.screenPreferenceRestoreContextKey = "";
      try {
        setThemeRootActive(root, false);
      } catch (_ignoreScreenProbeInactive) {}
      return;
    }

    var context = getScreenEditorContextSnapshot(root);
    var contextKey = context.contextKey || "";
    state.screenEditorVisible = true;
    if (contextKey) {
      state.lastScreenContextKey = contextKey;
    }

    setThemeRootActive(root, !!state.themeEnabled);
    ensureScreenThemeSwitcher(root);
    ensureScreenIdeSyncButton(root);
    ensureScreenBufferSize(root);
    var screenPrefContextKey = contextKey || "__screen-visible__";
    if (state.screenPreferenceRestoreContextKey !== screenPrefContextKey) {
      state.screenPreferenceRestoreContextKey = screenPrefContextKey;
      restoreScreenEditorViewPreferences(root);
    } else {
      ensureScreenEditorViewPreferenceBindings(root);
    }
    ensureScreenViewportBindings();

    if (contextKey) {
      var hasRememberedViewport = hasRememberedScreenViewportForKey(contextKey);
      if (state.screenLastRestoredContextKey !== contextKey) {
        if (!hasRememberedViewport || restoreScreenEditorViewportForKey(contextKey)) {
          state.screenLastRestoredContextKey = contextKey;
        }
      }

      if (state.screenLastRestoredContextKey === contextKey) {
        rememberScreenEditorViewportForKey(contextKey);
      }
    }

    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }
