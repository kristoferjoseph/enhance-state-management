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
    fn(payload);
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

export { API as default };
