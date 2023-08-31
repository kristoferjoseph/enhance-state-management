/* global self */
const CREATE  = 'create';
const UPDATE  = 'update';
const DESTROY = 'destroy';
const LIST    = 'list';

self.onmessage = stateMachine;

async function stateMachine ({ data }) {
  const { data: payload, type } = data;
  switch (type) {
  case CREATE:
    try {
      const response = await fetch(
        '/todos', {
          body: payload,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      );
      const result = await response.json();
      self.postMessage({
        type: CREATE,
        result
      });
    }
    catch (err) {
      // RESPOND WITH ERROR
      console.error(err);
    }
    break
  case UPDATE:
    try {
      const key = JSON.parse(payload).key;
      const result = await (await fetch(
        `/todos/${key}`, {
          body: payload,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      )).json();

      self.postMessage({
        type: UPDATE,
        result
      });
    }
    catch (err) {
      console.error(err);
    }
    break
  case DESTROY:
    try {
      const key = JSON.parse(payload).key;
      const result = await (await fetch(
        `/todos/${key}/delete`, {
          body: payload,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST'
        })).json();

      self.postMessage({
        type: DESTROY,
        result
      });
    }
    catch (err) {
      // RESPOND WITH ERROR
      console.error(err);
    }
    break
  case LIST:
    try {
      const result = await (await fetch(
        '/todos', {
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'GET'
        }
      )).json();

      self.postMessage({
        type: LIST,
        result
      });
    }
    catch (err) {
      // RESPOND WITH ERROR
      console.error(err);
    }
    break
  }
}
