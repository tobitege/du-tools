(function (ctx) {
  "use strict";

  var BUTTON_ID = "ModUiExtractor-chat-copy-plain";

  function trimChatText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function serializeChatClassList(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    var out = [];
    for (var i = 0; i < value.length && i < 8; i += 1) {
      var text = trimChatText(value[i]);
      if (text) {
        out.push(text);
      }
    }
    return out;
  }

  function isElementVisible(node) {
    if (!node) {
      return false;
    }
    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
      if (computed && (computed.display === "none" || computed.visibility === "hidden" || computed.opacity === "0")) {
        return false;
      }
    } catch (_ignoreComputed) {}
    return true;
  }

  function getChatRoot() {
    return document.querySelector(".main_chat");
  }

  function getChatView() {
    try {
      if (window.chatViewManager) {
        return window.chatViewManager.currentChatView || null;
      }
    } catch (_ignoreChatView) {}
    return null;
  }

  function getSelectedChatChannelData() {
    var currentView = getChatView();
    try {
      if (currentView && currentView._currentSelectedChannelView) {
        return currentView._currentSelectedChannelView.channelData || null;
      }
    } catch (_ignoreSelectedChannel) {}
    return null;
  }

  function getSelectedDomChatInfo() {
    var root = getChatRoot();
    var currentView = getChatView();
    var info = { channelId: null, channelName: null };
    var tabNode = null;

    try {
      if (currentView && currentView._currentSelectedChannelView && currentView._currentSelectedChannelView.HTMLNodes) {
        tabNode = currentView._currentSelectedChannelView.HTMLNodes.channelInput || null;
      }
    } catch (_ignoreCurrentTab) {}

    if (!tabNode && root && root.querySelector) {
      tabNode = root.querySelector(".channel_box .channel_btn.active_tab");
    }

    if (tabNode && typeof tabNode.getAttribute === "function") {
      var attrChannelId = trimChatText(tabNode.getAttribute("channel-id") || "");
      if (attrChannelId) {
        info.channelId = attrChannelId;
      }
      var labelNode = tabNode.querySelector ? tabNode.querySelector(".channel_label") : null;
      var tabChannelName = trimChatText(labelNode ? (labelNode.textContent || "") : "");
      if (tabChannelName) {
        info.channelName = tabChannelName;
      }
    }

    if (!info.channelName) {
      try {
        if (currentView && currentView.HTMLNodes && currentView.HTMLNodes.currentChannelLabel) {
          info.channelName = trimChatText(currentView.HTMLNodes.currentChannelLabel.textContent || "") || null;
        }
      } catch (_ignoreCurrentLabel) {}
    }

    if (!info.channelName && root && root.querySelector) {
      var currentChannelLabel = root.querySelector(".current_channel_label");
      info.channelName = trimChatText(currentChannelLabel ? (currentChannelLabel.textContent || "") : "") || null;
    }

    return info;
  }

  function buildChatChannelInfo(channelData, fallbackInfo) {
    var baseInfo = fallbackInfo || {};
    var channelId = null;
    var channelName = null;
    if (channelData && channelData.channelId != null) {
      channelId = trimChatText(String(channelData.channelId));
    }
    if (channelData && channelData.channelName != null) {
      channelName = trimChatText(String(channelData.channelName));
    }
    if (!channelId && baseInfo.channelId != null) {
      channelId = trimChatText(String(baseInfo.channelId));
    }
    if (!channelName && baseInfo.channelName != null) {
      channelName = trimChatText(String(baseInfo.channelName));
    }
    return {
      channelId: channelId || null,
      channelName: channelName || null
    };
  }

  function getChatManagerSafe() {
    try {
      if (typeof chatManager !== "undefined" && chatManager) {
        return chatManager;
      }
    } catch (_ignoreChatManagerGlobal) {}
    try {
      return window.chatManager || null;
    } catch (_ignoreChatManagerWindow) {}
    return null;
  }

  function getChatChannelDataById(channelId) {
    var normalizedId = trimChatText(channelId || "");
    if (!normalizedId) {
      return null;
    }
    var manager = getChatManagerSafe();
    if (!manager || typeof manager.getChannelData !== "function") {
      return null;
    }
    try {
      return manager.getChannelData(normalizedId) || null;
    } catch (_ignoreGetChannelData) {}
    return null;
  }

  function resolveActiveChatChannel() {
    var selectedChannel = getSelectedChatChannelData();
    var domInfo = getSelectedDomChatInfo();
    var info = buildChatChannelInfo(selectedChannel, domInfo);
    if (selectedChannel) {
      return { channel: selectedChannel, info: info };
    }
    if (info.channelId) {
      var channelFromManager = getChatChannelDataById(info.channelId);
      return {
        channel: channelFromManager,
        info: buildChatChannelInfo(channelFromManager, info)
      };
    }
    return { channel: null, info: info };
  }

  function serializeChatMessage(message, channelInfo) {
    if (!message) {
      return null;
    }
    var info = channelInfo || {};
    var dateValue = null;
    if (typeof message.date === "number" && isFinite(message.date)) {
      dateValue = message.date;
    } else if (typeof message.date === "string" && trimChatText(message.date)) {
      dateValue = trimChatText(message.date);
    }
    return {
      channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
      channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
      fromId: typeof message.fromId === "number" && isFinite(message.fromId) ? message.fromId : null,
      fromName: trimChatText(message.fromName || "") || null,
      text: trimChatText(message.sendText || ""),
      fromMe: !!message.fromMe,
      isAdmin: !!message.isAdmin,
      isCommunityHelper: !!message.isCommunityHelper,
      isNotification: !(typeof message.fromId === "number" && message.fromId > 0),
      date: dateValue,
      className: serializeChatClassList(message.className)
    };
  }

  function readAllDomChatMessagesForChannel(channelInfo) {
    var nodes = document.querySelectorAll(".main_chat .chat_wrapper .message_queue li");
    var messages = [];
    var info = channelInfo || {};
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.querySelector) {
        continue;
      }
      var nameNode = node.querySelector(".name");
      var messageNode = node.querySelector(".message");
      var text = trimChatText(messageNode ? (messageNode.textContent || "") : node.textContent || "");
      if (!text) {
        continue;
      }
      messages.push({
        channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
        channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
        fromId: null,
        fromName: trimChatText(nameNode ? (nameNode.textContent || "") : "") || null,
        text: text,
        fromMe: !!(nameNode && nameNode.classList && nameNode.classList.contains("user_link")),
        isAdmin: !!(messageNode && messageNode.classList && messageNode.classList.contains("admin")),
        isCommunityHelper: !!(messageNode && messageNode.classList && messageNode.classList.contains("community_helper")),
        isNotification: !(nameNode && trimChatText(nameNode.textContent || "")),
        date: null,
        className: []
      });
    }
    return messages;
  }

  function captureChatSnapshot() {
    var root = getChatRoot();
    var wrapper = root && root.querySelector ? root.querySelector(".chat_wrapper") : null;
    var selectedChannel = getSelectedChatChannelData();
    var currentView = getChatView();
    var domInfo = getSelectedDomChatInfo();
    var channelInfo = buildChatChannelInfo(selectedChannel, domInfo);
    var messages = [];
    var source = "dom";
    var limit = 20;

    if (selectedChannel && Array.isArray(selectedChannel.messageList)) {
      source = "chat_manager";
      var start = selectedChannel.messageList.length > limit ? selectedChannel.messageList.length - limit : 0;
      for (var i = start; i < selectedChannel.messageList.length; i += 1) {
        var serialized = serializeChatMessage(selectedChannel.messageList[i], channelInfo);
        if (serialized && serialized.text) {
          messages.push(serialized);
        }
      }
    } else {
      messages = readAllDomChatMessagesForChannel(channelInfo).slice(-limit);
    }

    return {
      visible: isElementVisible(wrapper || root),
      open: !!(currentView && currentView.showState),
      source: source,
      selectedChannelId: channelInfo.channelId,
      selectedChannelName: channelInfo.channelName,
      messageCount: messages.length,
      messages: messages
    };
  }

  function formatChatDateUtc(dateValue) {
    if (typeof dateValue === "number" && isFinite(dateValue)) {
      try {
        return new Date(dateValue).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
      } catch (_ignoreDateFormat) {}
    }
    if (typeof dateValue === "string") {
      return trimChatText(dateValue);
    }
    return "";
  }

  function formatChatMessagePlainText(message) {
    if (!message) {
      return "";
    }
    var text = trimChatText(message.text || "");
    if (!text) {
      return "";
    }
    var parts = [];
    var dateText = formatChatDateUtc(message.date);
    var fromName = trimChatText(message.fromName || "");
    if (dateText) {
      parts.push("[" + dateText + "]");
    }
    if (fromName) {
      parts.push(fromName + ":");
    }
    parts.push(text);
    return parts.join(" ");
  }

  function buildPlainTextChatTranscript() {
    var active = resolveActiveChatChannel();
    var selectedChannel = active.channel;
    var channelInfo = buildChatChannelInfo(selectedChannel, active.info);
    var messages = [];
    var source = "dom";
    if (selectedChannel && Array.isArray(selectedChannel.messageList)) {
      source = "chat_manager";
      for (var i = 0; i < selectedChannel.messageList.length; i += 1) {
        var serialized = serializeChatMessage(selectedChannel.messageList[i], channelInfo);
        if (serialized && serialized.text) {
          messages.push(serialized);
        }
      }
    } else {
      messages = readAllDomChatMessagesForChannel(channelInfo);
    }

    var lines = [];
    var channelLabel = channelInfo.channelName || channelInfo.channelId || "Unknown";
    if (channelInfo.channelId && channelInfo.channelName && channelInfo.channelId !== channelInfo.channelName) {
      channelLabel += " [" + channelInfo.channelId + "]";
    }
    lines.push("Channel: " + channelLabel);
    lines.push("");

    for (var j = 0; j < messages.length; j += 1) {
      var line = formatChatMessagePlainText(messages[j]);
      if (line) {
        lines.push(line);
      }
    }

    if (lines.length <= 2) {
      lines.push("(no messages)");
    }

    return {
      text: lines.join("\n"),
      source: source,
      channelId: channelInfo.channelId,
      channelName: channelInfo.channelName,
      messageCount: messages.length
    };
  }

  function copyTextToClipboard(text) {
    var value = String(text == null ? "" : text);
    if (!value) {
      return Promise.reject(new Error("chat_copy_empty"));
    }
    try {
      if (window.navigator && window.navigator.clipboard && typeof window.navigator.clipboard.writeText === "function") {
        return window.navigator.clipboard.writeText(value).then(function () {
          return true;
        });
      }
    } catch (_ignoreClipboardApi) {}

    try {
      if (window.clipboardData && typeof window.clipboardData.setData === "function") {
        if (window.clipboardData.setData("Text", value)) {
          return Promise.resolve(true);
        }
      }
    } catch (_ignoreLegacyClipboard) {}

    return new Promise(function (resolve, reject) {
      if (!document.body || typeof document.createElement !== "function") {
        reject(new Error("chat_copy_no_body"));
        return;
      }
      var textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      textarea.style.left = "-1000px";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      var copied = false;
      try {
        textarea.focus();
        textarea.select();
        if (typeof textarea.setSelectionRange === "function") {
          textarea.setSelectionRange(0, textarea.value.length);
        }
        copied = !!(document.execCommand && document.execCommand("copy"));
      } catch (_ignoreCopyExec) {
        copied = false;
      }
      try {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      } catch (_ignoreRemoveTextArea) {}
      if (copied) {
        resolve(true);
        return;
      }
      reject(new Error("chat_copy_exec_failed"));
    });
  }

  function flashButton(message, background, color, durationMs) {
    var button = document.getElementById(BUTTON_ID);
    if (!button) {
      return;
    }
    if (button.__luaProbeRestoreTimer) {
      try {
        window.clearTimeout(button.__luaProbeRestoreTimer);
      } catch (_ignoreRestoreTimer) {}
    }
    if (!button.__luaProbeDefaultText) {
      button.__luaProbeDefaultText = button.textContent || "Copy plain text";
    }
    button.textContent = String(message || button.__luaProbeDefaultText);
    button.style.background = background || "";
    button.style.color = color || "";
    button.__luaProbeRestoreTimer = window.setTimeout(function () {
      button.textContent = button.__luaProbeDefaultText;
      button.style.background = "";
      button.style.color = "";
      button.__luaProbeRestoreTimer = 0;
    }, typeof durationMs === "number" && durationMs > 0 ? durationMs : 1600);
  }

  function copyActiveChatPlainText() {
    var transcript = buildPlainTextChatTranscript();
    return copyTextToClipboard(transcript.text)
      .then(function () {
        flashButton("Copied plain text", "#2a6b36", "#ffffff", 1700);
        return transcript;
      })
      .catch(function (error) {
        flashButton("Copy failed", "#8a2424", "#ffffff", 2200);
        throw error;
      });
  }

  function ensureChatPlainTextCopyButton() {
    var root = getChatRoot();
    if (!root || !root.querySelector) {
      return;
    }
    var wrapper = root.querySelector(".chat_wrapper");
    if (!wrapper) {
      return;
    }

    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(wrapper, null) : null;
      if (!computed || computed.position === "static") {
        wrapper.style.position = "relative";
      }
    } catch (_ignorePosition) {
      wrapper.style.position = "relative";
    }

    var button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = BUTTON_ID;
      button.textContent = "Copy plain text";
      button.__luaProbeDefaultText = button.textContent;
      button.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        copyActiveChatPlainText();
      }, true);
      ctx.trackNode(button);
    }

    if (button.parentNode !== wrapper) {
      wrapper.appendChild(button);
    }

    var snapshot = captureChatSnapshot();
    var hasMessages = !!(snapshot && snapshot.messageCount > 0);
    button.disabled = !hasMessages;
    button.setAttribute("data-disabled", hasMessages ? "0" : "1");
    button.title = hasMessages ? "Copy current chat channel as plain text" : "No chat lines to copy";
    button.setAttribute("aria-label", button.title);
    button.style.display = isElementVisible(wrapper || root) ? "" : "none";
  }

  return {
    install: function () {
      ensureChatPlainTextCopyButton();
      ctx.setInterval(function () {
        ensureChatPlainTextCopyButton();
      }, 750);
    },
    uninstall: function () {}
  };
})
