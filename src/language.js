/**
 * Map HTML ids to messages.
 * @type {Object<string,(string|null)>}
 */
var HTML_MESSAGES = {
    ChromeNotReady: null,
};

/**
 * Replace HTML elements with classes of the form __MSG_*_ with the
 * appropriate i18n message.
 * @public
 */
function initI18nHtml() {
    for (var key in HTML_MESSAGES) {
        var value = HTML_MESSAGES[key];
        if (value === null) value = key;
        var className = '.__MSG_'+key+'__';
        var elems = $(className);
        elems.html(chrome.i18n.getMessage(value));
        elems.removeClass(className);
    }
}
