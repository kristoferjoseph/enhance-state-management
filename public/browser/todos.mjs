if (typeof process !== 'undefined') {
  global.HTMLElement = function() { return {} };
  global.customElements = {
    define: function() { },
    get: function() { }
  };
  global.Worker = function() { return { postMessage: function() { } } };
}

class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.store = {};
    this.context = {};
    this.instanceID = this.getAttribute('id') ||
      self.crypto.randomUUID();
  }

  get state() {
    const attrs = this.attributes.length
      ? this.attrsToObject(this.attributes)
      : {};

    return {
      attrs,
      context: this.context,
      instanceID: this.instanceID,
      store: this.store
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      const fun = `${name}Changed`;
      if (this[fun]) {
        this[fun](newValue);
      }
    }
  }

  attrsToObject(attrs = []) {
    const attrsObj = {};
    for (let d = attrs.length - 1; d >= 0; d--) {
      let attr = attrs[d];
      attrsObj[attr.nodeName] = attr.nodeValue;
    }
    return attrsObj
  }

  html(strings, ...values) {
    return String.raw({ raw: strings }, ...values)
  }
}

// Mixin specifically for reusing SFCs as Custom Elements in the browser
const CustomElementMixin = (superclass) => class extends superclass {
  constructor() {
    super();

    // Has this element been server side rendered
    const enhanced = this.hasAttribute('enhanced');

    // Handle style tags
    if (enhanced) {
      // Removes style tags as they are already inserted into the head by SSR
      this.template.content.querySelectorAll('style')
        .forEach((tag) => { this.template.content.removeChild(tag); });
    } else {
      let tagName = this.tagName;
      this.template.content.querySelectorAll('style')
        .forEach((tag) => {
          let sheet = this.styleTransform({ tag, tagName, scope: tag.getAttribute('scope') });
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
          this.template.content.removeChild(tag);
        });
    }

    // Removes script tags as they are already appended to the body by SSR
    // TODO: If only added dynamically in the browser we need to insert the script tag after running the script transform on it. As well as handle deduplication.
    this.template.content.querySelectorAll('script')
      .forEach((tag) => { this.template.content.removeChild(tag); });

    // Expands the Custom Element with the template content
    const hasSlots = this.template.content.querySelectorAll('slot')?.length;

    // If the Custom Element was already expanded by SSR it will have the "enhanced" attribute so do not replaceChildren
    // If this Custom Element was added dynamically with JavaScript then use the template contents to expand the element
    if (!enhanced && !hasSlots) {
      this.replaceChildren(this.template.content.cloneNode(true));
    } else if (!enhanced && hasSlots) {
      this.innerHTML = this.expandSlots(this);
    }
  }

  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
  }

  styleTransform({ tag, tagName, scope }) {
    const styles = this.parseCSS(tag.textContent);

    if (scope === 'global') {
      return styles
    }

    const rules = styles.cssRules;
    const sheet = new CSSStyleSheet();
    for (let rule of rules) {
      if (rule.conditionText) {
        let selectorText = '';
        for (let innerRule of rule.cssRules) {
          let selectors = innerRule.selectorText.split(',');
          selectorText = selectors.map(selector => {
            return innerRule.cssText.replace(innerRule.selectorText, this.transform(selector, tagName))
          }).join(',');
        }
        let type = this.getRuleType(rule);
        sheet.insertRule(`${type} ${rule.conditionText} { ${selectorText}}`, sheet.cssRules.length);
      } else {
        let selectors = rule.selectorText.split(',');
        let selectorText = selectors.map(selector => {
          return this.transform(selector, tagName)
        }).join(',');
        sheet.insertRule(rule.cssText.replace(rule.selectorText, selectorText), sheet.cssRules.length);
      }
    }
    return sheet
  }

  getRuleType(rule) {
    switch (rule.constructor) {
      case CSSContainerRule:
        return '@container'
      case CSSMediaRule:
        return '@media'
      case CSSSupportsRule:
        return '@supports'
      default:
        return null
    }
  }

  transform(input, tagName) {
    let out = input;
    out = out.replace(/(::slotted)\(\s*(.+)\s*\)/, '$2')
      .replace(/(:host-context)\(\s*(.+)\s*\)/, '$2 __TAGNAME__')
      .replace(/(:host)\(\s*(.+)\s*\)/, '__TAGNAME__$2')
      .replace(
        /([[a-zA-Z0-9_-]*)(::part)\(\s*(.+)\s*\)/,
        '$1 [part*="$3"][part*="$1"]')
      .replace(':host', '__TAGNAME__');
    out = /__TAGNAME__/.test(out) ? out.replace(/(.*)__TAGNAME__(.*)/, `$1${tagName}$2`) : `${tagName} ${out}`;
    return out
  }

  parseCSS(styleContent) {
    const doc = document.implementation.createHTMLDocument("");
    const styleElement = document.createElement("style");

    styleElement.textContent = styleContent;
    doc.body.appendChild(styleElement);

    return styleElement.sheet
  }


  expandSlots(here) {
    const fragment = document.createElement('div');
    fragment.innerHTML = here.innerHTML;
    fragment.attachShadow({ mode: 'open' }).appendChild(
      here.template.content.cloneNode(true)
    );

    const children = Array.from(fragment.childNodes);
    let unnamedSlot = {};
    let namedSlots = {};

    children.forEach(child => {
      const slot = child.assignedSlot;
      if (slot) {
        if (slot.name) {
          if (!namedSlots[slot.name]) namedSlots[slot.name] = { slotNode: slot, contentToSlot: [] };
          namedSlots[slot.name].contentToSlot.push(child);
        } else {
          if (!unnamedSlot["slotNode"]) unnamedSlot = { slotNode: slot, contentToSlot: [] };
          unnamedSlot.contentToSlot.push(child);
        }
      }
    });

    // Named Slots
    Object.entries(namedSlots).forEach(([name, slot]) => {
      slot.slotNode.after(...namedSlots[name].contentToSlot);
      slot.slotNode.remove();
    });

    // Unnamed Slot
    unnamedSlot.slotNode?.after(...unnamedSlot.contentToSlot);
    unnamedSlot.slotNode?.remove();

    // Unused slots and default content
    const unfilledUnnamedSlots = Array.from(fragment.shadowRoot.querySelectorAll('slot:not([name])'));
    unfilledUnnamedSlots.forEach(slot => slot.remove());
    const unfilledSlots = Array.from(fragment.shadowRoot.querySelectorAll('slot[name]'));
    unfilledSlots.forEach(slot => {
      const as = slot.getAttribute('as') || 'span';
      const asElement = document.createElement(as);
      while (slot.childNodes.length > 0) {
        asElement.appendChild(slot.childNodes[0]);
      }
      slot.after(asElement);
      slot.remove();
    });

    return fragment.shadowRoot.innerHTML
  }

};

const TemplateMixin = (superclass) => class extends superclass {
  constructor() {
    super();
    if (!this.render || !this.html) {
      throw new Error('TemplateMixin must extend Enhance BaseElement')
    }
    const templateName = `${this.tagName.toLowerCase()}-template`;
    const template = document.getElementById(templateName);
    const html = this.html;
    const state = {};
    if (template) {
      this.template = template;
    }
    else {
      this.template = document.createElement('template');
      this.template.innerHTML = this.render({ html, state });
      this.template.setAttribute('id', templateName);
      document.body.appendChild(this.template);
    }
  }
};

class CustomElement extends CustomElementMixin(TemplateMixin(BaseElement)) {}

var DOCUMENT_FRAGMENT_NODE = 11;

function morphAttrs(fromNode, toNode) {
    var toNodeAttrs = toNode.attributes;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    // document-fragments dont have attributes so lets not do anything
    if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    // update attributes on original DOM element
    for (var i = toNodeAttrs.length - 1; i >= 0; i--) {
        attr = toNodeAttrs[i];
        attrName = attr.name;
        attrNamespaceURI = attr.namespaceURI;
        attrValue = attr.value;

        if (attrNamespaceURI) {
            attrName = attr.localName || attrName;
            fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);

            if (fromValue !== attrValue) {
                if (attr.prefix === 'xmlns'){
                    attrName = attr.name; // It's not allowed to set an attribute with the XMLNS namespace without specifying the `xmlns` prefix
                }
                fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
            }
        } else {
            fromValue = fromNode.getAttribute(attrName);

            if (fromValue !== attrValue) {
                fromNode.setAttribute(attrName, attrValue);
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    var fromNodeAttrs = fromNode.attributes;

    for (var d = fromNodeAttrs.length - 1; d >= 0; d--) {
        attr = fromNodeAttrs[d];
        attrName = attr.name;
        attrNamespaceURI = attr.namespaceURI;

        if (attrNamespaceURI) {
            attrName = attr.localName || attrName;

            if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
                fromNode.removeAttributeNS(attrNamespaceURI, attrName);
            }
        } else {
            if (!toNode.hasAttribute(attrName)) {
                fromNode.removeAttribute(attrName);
            }
        }
    }
}

var range; // Create a range object for efficently rendering strings to elements.
var NS_XHTML = 'http://www.w3.org/1999/xhtml';

var doc = typeof document === 'undefined' ? undefined : document;
var HAS_TEMPLATE_SUPPORT = !!doc && 'content' in doc.createElement('template');
var HAS_RANGE_SUPPORT = !!doc && doc.createRange && 'createContextualFragment' in doc.createRange();

function createFragmentFromTemplate(str) {
    var template = doc.createElement('template');
    template.innerHTML = str;
    return template.content.childNodes[0];
}

function createFragmentFromRange(str) {
    if (!range) {
        range = doc.createRange();
        range.selectNode(doc.body);
    }

    var fragment = range.createContextualFragment(str);
    return fragment.childNodes[0];
}

function createFragmentFromWrap(str) {
    var fragment = doc.createElement('body');
    fragment.innerHTML = str;
    return fragment.childNodes[0];
}

/**
 * This is about the same
 * var html = new DOMParser().parseFromString(str, 'text/html');
 * return html.body.firstChild;
 *
 * @method toElement
 * @param {String} str
 */
function toElement(str) {
    str = str.trim();
    if (HAS_TEMPLATE_SUPPORT) {
      // avoid restrictions on content for things like `<tr><th>Hi</th></tr>` which
      // createContextualFragment doesn't support
      // <template> support not available in IE
      return createFragmentFromTemplate(str);
    } else if (HAS_RANGE_SUPPORT) {
      return createFragmentFromRange(str);
    }

    return createFragmentFromWrap(str);
}

/**
 * Returns true if two node's names are the same.
 *
 * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
 *       nodeName and different namespace URIs.
 *
 * @param {Element} a
 * @param {Element} b The target element
 * @return {boolean}
 */
function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;
    var fromCodeStart, toCodeStart;

    if (fromNodeName === toNodeName) {
        return true;
    }

    fromCodeStart = fromNodeName.charCodeAt(0);
    toCodeStart = toNodeName.charCodeAt(0);

    // If the target element is a virtual DOM node or SVG node then we may
    // need to normalize the tag name before comparing. Normal HTML elements that are
    // in the "http://www.w3.org/1999/xhtml"
    // are converted to upper case
    if (fromCodeStart <= 90 && toCodeStart >= 97) { // from is upper and to is lower
        return fromNodeName === toNodeName.toUpperCase();
    } else if (toCodeStart <= 90 && fromCodeStart >= 97) { // to is upper and from is lower
        return toNodeName === fromNodeName.toUpperCase();
    } else {
        return false;
    }
}

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ?
        doc.createElement(name) :
        doc.createElementNS(namespaceURI, name);
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
        fromEl[name] = toEl[name];
        if (fromEl[name]) {
            fromEl.setAttribute(name, '');
        } else {
            fromEl.removeAttribute(name);
        }
    }
}

var specialElHandlers = {
    OPTION: function(fromEl, toEl) {
        var parentNode = fromEl.parentNode;
        if (parentNode) {
            var parentName = parentNode.nodeName.toUpperCase();
            if (parentName === 'OPTGROUP') {
                parentNode = parentNode.parentNode;
                parentName = parentNode && parentNode.nodeName.toUpperCase();
            }
            if (parentName === 'SELECT' && !parentNode.hasAttribute('multiple')) {
                if (fromEl.hasAttribute('selected') && !toEl.selected) {
                    // Workaround for MS Edge bug where the 'selected' attribute can only be
                    // removed if set to a non-empty value:
                    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/12087679/
                    fromEl.setAttribute('selected', 'selected');
                    fromEl.removeAttribute('selected');
                }
                // We have to reset select element's selectedIndex to -1, otherwise setting
                // fromEl.selected using the syncBooleanAttrProp below has no effect.
                // The correct selectedIndex will be set in the SELECT special handler below.
                parentNode.selectedIndex = -1;
            }
        }
        syncBooleanAttrProp(fromEl, toEl, 'selected');
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'checked');
        syncBooleanAttrProp(fromEl, toEl, 'disabled');

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!toEl.hasAttribute('value')) {
            fromEl.removeAttribute('value');
        }
    },

    TEXTAREA: function(fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        var firstChild = fromEl.firstChild;
        if (firstChild) {
            // Needed for IE. Apparently IE sets the placeholder as the
            // node value and vise versa. This ignores an empty update.
            var oldValue = firstChild.nodeValue;

            if (oldValue == newValue || (!newValue && oldValue == fromEl.placeholder)) {
                return;
            }

            firstChild.nodeValue = newValue;
        }
    },
    SELECT: function(fromEl, toEl) {
        if (!toEl.hasAttribute('multiple')) {
            var selectedIndex = -1;
            var i = 0;
            // We have to loop through children of fromEl, not toEl since nodes can be moved
            // from toEl to fromEl directly when morphing.
            // At the time this special handler is invoked, all children have already been morphed
            // and appended to / removed from fromEl, so using fromEl here is safe and correct.
            var curChild = fromEl.firstChild;
            var optgroup;
            var nodeName;
            while(curChild) {
                nodeName = curChild.nodeName && curChild.nodeName.toUpperCase();
                if (nodeName === 'OPTGROUP') {
                    optgroup = curChild;
                    curChild = optgroup.firstChild;
                } else {
                    if (nodeName === 'OPTION') {
                        if (curChild.hasAttribute('selected')) {
                            selectedIndex = i;
                            break;
                        }
                        i++;
                    }
                    curChild = curChild.nextSibling;
                    if (!curChild && optgroup) {
                        curChild = optgroup.nextSibling;
                        optgroup = null;
                    }
                }
            }

            fromEl.selectedIndex = selectedIndex;
        }
    }
};

var ELEMENT_NODE = 1;
var DOCUMENT_FRAGMENT_NODE$1 = 11;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;

function noop() {}

function defaultGetNodeKey(node) {
  if (node) {
    return (node.getAttribute && node.getAttribute('id')) || node.id;
  }
}

function morphdomFactory(morphAttrs) {

  return function morphdom(fromNode, toNode, options) {
    if (!options) {
      options = {};
    }

    if (typeof toNode === 'string') {
      if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML' || fromNode.nodeName === 'BODY') {
        var toNodeHtml = toNode;
        toNode = doc.createElement('html');
        toNode.innerHTML = toNodeHtml;
      } else {
        toNode = toElement(toNode);
      }
    } else if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
      toNode = toNode.firstElementChild;
    }

    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
    var skipFromChildren = options.skipFromChildren || noop;
    var addChild = options.addChild || function(parent, child){ return parent.appendChild(child); };
    var childrenOnly = options.childrenOnly === true;

    // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
    var fromNodesLookup = Object.create(null);
    var keyedRemovalList = [];

    function addKeyedRemoval(key) {
      keyedRemovalList.push(key);
    }

    function walkDiscardedChildNodes(node, skipKeyedNodes) {
      if (node.nodeType === ELEMENT_NODE) {
        var curChild = node.firstChild;
        while (curChild) {

          var key = undefined;

          if (skipKeyedNodes && (key = getNodeKey(curChild))) {
            // If we are skipping keyed nodes then we add the key
            // to a list so that it can be handled at the very end.
            addKeyedRemoval(key);
          } else {
            // Only report the node as discarded if it is not keyed. We do this because
            // at the end we loop through all keyed elements that were unmatched
            // and then discard them in one final pass.
            onNodeDiscarded(curChild);
            if (curChild.firstChild) {
              walkDiscardedChildNodes(curChild, skipKeyedNodes);
            }
          }

          curChild = curChild.nextSibling;
        }
      }
    }

    /**
    * Removes a DOM node out of the original DOM
    *
    * @param  {Node} node The node to remove
    * @param  {Node} parentNode The nodes parent
    * @param  {Boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
    * @return {undefined}
    */
    function removeNode(node, parentNode, skipKeyedNodes) {
      if (onBeforeNodeDiscarded(node) === false) {
        return;
      }

      if (parentNode) {
        parentNode.removeChild(node);
      }

      onNodeDiscarded(node);
      walkDiscardedChildNodes(node, skipKeyedNodes);
    }

    // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
    // function indexTree(root) {
    //     var treeWalker = document.createTreeWalker(
    //         root,
    //         NodeFilter.SHOW_ELEMENT);
    //
    //     var el;
    //     while((el = treeWalker.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
    //
    // function indexTree(node) {
    //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
    //     var el;
    //     while((el = nodeIterator.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    function indexTree(node) {
      if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
        var curChild = node.firstChild;
        while (curChild) {
          var key = getNodeKey(curChild);
          if (key) {
            fromNodesLookup[key] = curChild;
          }

          // Walk recursively
          indexTree(curChild);

          curChild = curChild.nextSibling;
        }
      }
    }

    indexTree(fromNode);

    function handleNodeAdded(el) {
      onNodeAdded(el);

      var curChild = el.firstChild;
      while (curChild) {
        var nextSibling = curChild.nextSibling;

        var key = getNodeKey(curChild);
        if (key) {
          var unmatchedFromEl = fromNodesLookup[key];
          // if we find a duplicate #id node in cache, replace `el` with cache value
          // and morph it to the child node.
          if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
            curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
            morphEl(unmatchedFromEl, curChild);
          } else {
            handleNodeAdded(curChild);
          }
        } else {
          // recursively call for curChild and it's children to see if we find something in
          // fromNodesLookup
          handleNodeAdded(curChild);
        }

        curChild = nextSibling;
      }
    }

    function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
      // We have processed all of the "to nodes". If curFromNodeChild is
      // non-null then we still have some from nodes left over that need
      // to be removed
      while (curFromNodeChild) {
        var fromNextSibling = curFromNodeChild.nextSibling;
        if ((curFromNodeKey = getNodeKey(curFromNodeChild))) {
          // Since the node is keyed it might be matched up later so we defer
          // the actual removal to later
          addKeyedRemoval(curFromNodeKey);
        } else {
          // NOTE: we skip nested keyed nodes from being removed since there is
          //       still a chance they will be matched up later
          removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
        }
        curFromNodeChild = fromNextSibling;
      }
    }

    function morphEl(fromEl, toEl, childrenOnly) {
      var toElKey = getNodeKey(toEl);

      if (toElKey) {
        // If an element with an ID is being morphed then it will be in the final
        // DOM so clear it out of the saved elements collection
        delete fromNodesLookup[toElKey];
      }

      if (!childrenOnly) {
        // optional
        if (onBeforeElUpdated(fromEl, toEl) === false) {
          return;
        }

        // update attributes on original DOM element first
        morphAttrs(fromEl, toEl);
        // optional
        onElUpdated(fromEl);

        if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
          return;
        }
      }

      if (fromEl.nodeName !== 'TEXTAREA') {
        morphChildren(fromEl, toEl);
      } else {
        specialElHandlers.TEXTAREA(fromEl, toEl);
      }
    }

    function morphChildren(fromEl, toEl) {
      var skipFrom = skipFromChildren(fromEl, toEl);
      var curToNodeChild = toEl.firstChild;
      var curFromNodeChild = fromEl.firstChild;
      var curToNodeKey;
      var curFromNodeKey;

      var fromNextSibling;
      var toNextSibling;
      var matchingFromEl;

      // walk the children
      outer: while (curToNodeChild) {
        toNextSibling = curToNodeChild.nextSibling;
        curToNodeKey = getNodeKey(curToNodeChild);

        // walk the fromNode children all the way through
        while (!skipFrom && curFromNodeChild) {
          fromNextSibling = curFromNodeChild.nextSibling;

          if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
            curToNodeChild = toNextSibling;
            curFromNodeChild = fromNextSibling;
            continue outer;
          }

          curFromNodeKey = getNodeKey(curFromNodeChild);

          var curFromNodeType = curFromNodeChild.nodeType;

          // this means if the curFromNodeChild doesnt have a match with the curToNodeChild
          var isCompatible = undefined;

          if (curFromNodeType === curToNodeChild.nodeType) {
            if (curFromNodeType === ELEMENT_NODE) {
              // Both nodes being compared are Element nodes

              if (curToNodeKey) {
                // The target node has a key so we want to match it up with the correct element
                // in the original DOM tree
                if (curToNodeKey !== curFromNodeKey) {
                  // The current element in the original DOM tree does not have a matching key so
                  // let's check our lookup to see if there is a matching element in the original
                  // DOM tree
                  if ((matchingFromEl = fromNodesLookup[curToNodeKey])) {
                    if (fromNextSibling === matchingFromEl) {
                      // Special case for single element removals. To avoid removing the original
                      // DOM node out of the tree (since that can break CSS transitions, etc.),
                      // we will instead discard the current node and wait until the next
                      // iteration to properly match up the keyed target element with its matching
                      // element in the original tree
                      isCompatible = false;
                    } else {
                      // We found a matching keyed element somewhere in the original DOM tree.
                      // Let's move the original DOM node into the current position and morph
                      // it.

                      // NOTE: We use insertBefore instead of replaceChild because we want to go through
                      // the `removeNode()` function for the node that is being discarded so that
                      // all lifecycle hooks are correctly invoked
                      fromEl.insertBefore(matchingFromEl, curFromNodeChild);

                      // fromNextSibling = curFromNodeChild.nextSibling;

                      if (curFromNodeKey) {
                        // Since the node is keyed it might be matched up later so we defer
                        // the actual removal to later
                        addKeyedRemoval(curFromNodeKey);
                      } else {
                        // NOTE: we skip nested keyed nodes from being removed since there is
                        //       still a chance they will be matched up later
                        removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                      }

                      curFromNodeChild = matchingFromEl;
                    }
                  } else {
                    // The nodes are not compatible since the "to" node has a key and there
                    // is no matching keyed node in the source tree
                    isCompatible = false;
                  }
                }
              } else if (curFromNodeKey) {
                // The original has a key
                isCompatible = false;
              }

              isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
              if (isCompatible) {
                // We found compatible DOM elements so transform
                // the current "from" node to match the current
                // target DOM node.
                // MORPH
                morphEl(curFromNodeChild, curToNodeChild);
              }

            } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
              // Both nodes being compared are Text or Comment nodes
              isCompatible = true;
              // Simply update nodeValue on the original node to
              // change the text value
              if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
              }

            }
          }

          if (isCompatible) {
            // Advance both the "to" child and the "from" child since we found a match
            // Nothing else to do as we already recursively called morphChildren above
            curToNodeChild = toNextSibling;
            curFromNodeChild = fromNextSibling;
            continue outer;
          }

          // No compatible match so remove the old node from the DOM and continue trying to find a
          // match in the original DOM. However, we only do this if the from node is not keyed
          // since it is possible that a keyed node might match up with a node somewhere else in the
          // target tree and we don't want to discard it just yet since it still might find a
          // home in the final DOM tree. After everything is done we will remove any keyed nodes
          // that didn't find a home
          if (curFromNodeKey) {
            // Since the node is keyed it might be matched up later so we defer
            // the actual removal to later
            addKeyedRemoval(curFromNodeKey);
          } else {
            // NOTE: we skip nested keyed nodes from being removed since there is
            //       still a chance they will be matched up later
            removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
          }

          curFromNodeChild = fromNextSibling;
        } // END: while(curFromNodeChild) {}

        // If we got this far then we did not find a candidate match for
        // our "to node" and we exhausted all of the children "from"
        // nodes. Therefore, we will just append the current "to" node
        // to the end
        if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
          // MORPH
          if(!skipFrom){ addChild(fromEl, matchingFromEl); }
          morphEl(matchingFromEl, curToNodeChild);
        } else {
          var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
          if (onBeforeNodeAddedResult !== false) {
            if (onBeforeNodeAddedResult) {
              curToNodeChild = onBeforeNodeAddedResult;
            }

            if (curToNodeChild.actualize) {
              curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
            }
            addChild(fromEl, curToNodeChild);
            handleNodeAdded(curToNodeChild);
          }
        }

        curToNodeChild = toNextSibling;
        curFromNodeChild = fromNextSibling;
      }

      cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey);

      var specialElHandler = specialElHandlers[fromEl.nodeName];
      if (specialElHandler) {
        specialElHandler(fromEl, toEl);
      }
    } // END: morphChildren(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
      // Handle the case where we are given two DOM nodes that are not
      // compatible (e.g. <div> --> <span> or <div> --> TEXT)
      if (morphedNodeType === ELEMENT_NODE) {
        if (toNodeType === ELEMENT_NODE) {
          if (!compareNodeNames(fromNode, toNode)) {
            onNodeDiscarded(fromNode);
            morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
          }
        } else {
          // Going from an element node to a text node
          morphedNode = toNode;
        }
      } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // Text or comment node
        if (toNodeType === morphedNodeType) {
          if (morphedNode.nodeValue !== toNode.nodeValue) {
            morphedNode.nodeValue = toNode.nodeValue;
          }

          return morphedNode;
        } else {
          // Text node to something else
          morphedNode = toNode;
        }
      }
    }

    if (morphedNode === toNode) {
      // The "to node" was not compatible with the "from node" so we had to
      // toss out the "from node" and use the "to node"
      onNodeDiscarded(fromNode);
    } else {
      if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
        return;
      }

      morphEl(morphedNode, toNode, childrenOnly);

      // We now need to loop over any keyed nodes that might need to be
      // removed. We only do the removal if we know that the keyed node
      // never found a match. When a keyed node is matched up we remove
      // it out of fromNodesLookup and we use fromNodesLookup to determine
      // if a keyed node has been matched up or not
      if (keyedRemovalList) {
        for (var i=0, len=keyedRemovalList.length; i<len; i++) {
          var elToRemove = fromNodesLookup[keyedRemovalList[i]];
          if (elToRemove) {
            removeNode(elToRemove, elToRemove.parentNode, false);
          }
        }
      }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
      if (morphedNode.actualize) {
        morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
      }
      // If we had to swap out the from node with a new node because the old
      // node was not compatible with the target node then we need to
      // replace the old DOM node in the original DOM tree. This is only
      // possible if the original DOM node was part of a DOM tree which
      // we know is the case if it has a parent node.
      fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
  };
}

var morphdom = morphdomFactory(morphAttrs);

const MorphdomMixin = (superclass) => class extends superclass {
  constructor(args) {
    super(args);
    this.process = this.process.bind(this);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.process();
    }
  }

  process() {
    const tmp = this.render({
      html: this.html,
      state: this.state
    });
    const updated = document.createElement('div');
    updated.innerHTML = tmp.trim();
    const root = this.shadowRoot
      ? this.shadowRoot
      : this;
    morphdom(
      root,
      updated,
      {
        childrenOnly: true
      }
    );
  }
};

function TodosList({ html, state }) {
  const { store={} } = state;
  const { todos=[] } = store;
  const items = todos.map(({ created, completed, key, text })  => {
    completed = completed?.toString() === 'true';
    return html`
    <li id="${key}">
      <todos-item
        class="flex"
        created="${created}"
        ${completed ? 'completed' : ''}
        key="${key}"
        text="${text}"
      ></todos-item>
    </li>
  `})
    .join('\n');
  return html`
    <ul>
      ${todos.length ? items : `<li>Add a todo.</li>`}
    </ul>
  `
}

function TodosItem({ html, state }) {
  const { attrs={} } = state;
  const { created='', key='', text='' } = attrs;
  const checked = Object.keys(attrs).includes('completed')
    ? 'checked'
    : '';

  return html`
    <form
     action="/todos/${key}"
     class="
      flex
      flex-grow
      items-center
     "
     method="POST"
    >
      <input
        id="check-${key}"
        class="
         inline-block
         mr1
         radius1
        "
        name="completed"
        type="checkbox"
        ${checked}

      >
      <input
        type="text"
        name="text"
        value="${text}"
        class="
          flex-grow
          mr1
          p-2
        "
      >
      <input
        type="hidden"
        name="created"
        value="${created}"
      >
      <input type="hidden" name="key" value="${key}">
    </form>

    <form
      action="/todos/${key}/delete"
      method="POST"
    >
      <input type="hidden" name="key" value="${key}">
      <button class="p-2">❌</button>
    </form>
  `
}

const _state = {};
const dirtyProps = [];
const listeners = [];
const inWindow = typeof window != 'undefined';
const set = inWindow
  ? window.requestAnimationFrame
  : setTimeout;
const cancel = inWindow
  ? window.cancelAnimationFrame
  : clearTimeout;
let timeout;
const handler = {
  set: function (obj, prop, value) {
    if (prop === 'initialize' ||
        prop === 'subscribe' ||
        prop === 'unsubscribe') {
      return false
    }
    let oldValue = obj[prop];
    if (oldValue !== value) {
      obj[prop] = value;
      dirtyProps.push(prop);
      timeout && cancel(timeout);
      timeout = set(notify);
    }

    return true
  }
};

_state.initialize = initialize$1;
_state.subscribe = subscribe;
_state.unsubscribe = unsubscribe;
const store$1 = new Proxy(_state, handler);

function Store(initialState) {
  if (initialState) {
    initialize$1(initialState);
  }
  return store$1
}

function merge (o, n) {
  for (let prop in n) {
    o[prop] = n[prop];
  }
}

/**
 * Function for initializing store with existing data
 * @param {object} initialState - object to be merged with internal state
 */
function initialize$1(initialState) {
  if (initialState) {
    merge(_state, initialState);
  }
}

/**
 * Function for subscribing to state updates.
 * @param {function} fn - function to be called when state changes
 * @param {array} props - list props to listen to for changes
 * @return {number} returns current number of listeners
 */
function subscribe(fn, props=[]) {
  return listeners.push({ fn, props })
}

/**
 * Function for unsubscribing from state updates.
 * @param {function} fn - function to unsubscribe from state updates
 *
 */
function unsubscribe(fn) {
  return listeners.splice(listeners.findIndex(l => l.fn === fn), 1)
}

function notify() {
  listeners.forEach(l => {
    const fn = l.fn;
    const props = l.props;
    const payload = props.length
      ? dirtyProps
        .filter(key => props.includes(key))
        .reduce((obj, key) => {
          return {
            ...obj,
            [key]: _state[key]
          }
        }, {})
      : { ..._state };
    if (Object.keys(payload).length)  {
      fn(payload);
    }
  });
  dirtyProps.length = 0;
}

/* global window, Worker */
const store = Store();

const CREATE  = 'create';
const UPDATE  = 'update';
const DESTROY = 'destroy';
const LIST    = 'list';

let worker;
function API() {
  if (!worker) {
    worker = new Worker('/_public/browser/worker.mjs');
    worker.onmessage = mutate;
  }

  initialize();

  return {
    create,
    update,
    destroy,
    list,
    store,
    subscribe: store.subscribe,
    unsubscribe: store.unsubscribe
  }
}

function initialize() {
  list();
}

function mutate(e) {
  const { data } = e;
  const { result, type } = data;
  switch (type) {
  case CREATE:
    createMutation(result);
    break
  case UPDATE:
    updateMutation(result);
    break
  case DESTROY:
    destroyMutation(result);
    break
  case LIST:
    listMutation(result);
    break
  }
}

function createMutation({ todo={}, problems={} }) {
  const copy = store?.todos?.slice() || [];
  copy.push(todo);
  store.todos = copy;
  store.problems = problems;
}

function updateMutation({ todo={}, problems={} }) {
  const copy = store?.todos?.slice() || [];
  copy.splice(copy.findIndex(i => i.key === todo.key), 1, todo);
  store.todos = copy;
  store.problems = problems;
}

function destroyMutation({ todo={}, problems={} }) {
  let copy = store?.todos?.slice() || [];
  copy.splice(copy.findIndex(i => i.key === todo.key), 1);
  store.todos = copy;
  store.problems = problems;
}

function listMutation({ todos=[], problems={} }) {
  store.initialize({ todos, problems });
}

function processForm(form) {
  return JSON.stringify(
    Object.fromEntries(
      new FormData(form)
    )
  )
}

function create(form) {
  const todo = processForm(form);
  worker.postMessage({
    type: CREATE,
    data: todo
  });
}

function destroy (form) {
  const todo = processForm(form);
  worker.postMessage({
    type: DESTROY,
    data: todo
  });
}

function list () {
  worker.postMessage({
    type: LIST
  });
}

function update (form) {
  const todo = processForm(form);
  worker.postMessage({
    type: UPDATE,
    data: todo
  });
}

/* global customElements, HTMLElement */
const api = API();

class TodosCreateForm extends HTMLElement {
  constructor() {
    super();
    this.api = api;
    this.submit = this.submit.bind(this);
    this.resetForm = this.resetForm.bind(this);
  }

  connectedCallback() {
    this.addEventListener('submit', this.submit);
    this.form = this.querySelector('form');
    this.textInput = this.querySelector('input[type="text"]');
    this.textInput.focus();
  }

  resetForm() {
    this.textInput.value = '';
    this.textInput.focus();
  }

  submit(e) {
    e.preventDefault();
    this.api.create(this.form);
    this.resetForm();
  }
}
customElements.define('todos-create', TodosCreateForm);

class TodosListElement extends MorphdomMixin(CustomElement) {
  keys = ['todos']
  constructor() {
    super();
    this.api = api;
    this.store = api.store;
    this.store.subscribe(this.process, this.keys);
  }

  connectedCallback() {
    this.api.list();
  }

  render(args) {
    return TodosList(args)
  }

  disconnectedCallback() {
    this.store.unsubscribe(this.process);
  }
}
customElements.define('todos-list', TodosListElement);

class TodosItemElement extends MorphdomMixin(CustomElement) {
  constructor() {
    super();
    this.api = api;
    this.update = this.update.bind(this);
    this.updateChecked = this.updateChecked.bind(this);
    this.destroy = this.destroy.bind(this);
    this.shouldCallAPI = this.shouldCallAPI.bind(this);
  }

  connectedCallback() {
    const key = this.getAttribute('key');
    this.updateForm = this.querySelector(`form[action='/todos/${key}']`);
    this.deleteForm = this.querySelector(`form[action='/todos/${key}/delete']`);
    this.updateForm.addEventListener('submit', this.update);
    this.deleteForm.addEventListener('submit', this.destroy);
    this.checkboxInput = this.querySelector('input[type="checkbox"]');
    this.checkboxInput.addEventListener('click', this.updateChecked);
    this.textInput = this.querySelector('input[type="text"]');
    this.textInput.addEventListener('focusout', this.shouldCallAPI);
  }

  static observedAttributes = [
    'key',
    'text',
    'completed'
  ]

  shouldCallAPI(e) {
    // Cuts down on unnecessary API calls
    const text = this.getAttribute('text');
    const value = e.target.value;
    if (text !== value) {
      this.update();
    }
  }

  update(e) {
    // Check for the existance of the event so we can call this method from other handlers
    e && e.preventDefault();
    this.api.update(this.updateForm);
  }

  updateChecked(e) {
    e && e.preventDefault();
    this.update();
  }

  destroy(e) {
    e.preventDefault();
    this.api.destroy(this.deleteForm);
  }

  render(args) {
    return TodosItem(args)
  }

}
customElements.define('todos-item', TodosItemElement);
