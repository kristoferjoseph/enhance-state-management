import data from '@begin/data'
import { validator } from '@begin/validator'
import { Todo } from './schemas/todo.mjs'

const deleteTodo = async function (key) {
  await data.destroy({ table: 'todos', key })
  return { key }
}

const upsertTodo = async function (todo) {
  return data.set({ table: 'todos', ...todo })
}

const getTodo = async function (key) {
  return data.get({ table: 'todos', key })
}

const getTodos = async function () {
  const pages = await data.page({
    table: 'todos',
    limit: 2
  })

  let todos = []
  for await (let page of pages) {
    for (let todo of page) {
      delete todo.table
      todos.push(todo)
    }
  }

  todos.sort((a, b) => (a.created < b.created)
    ? -1
    : (a.created > b.created)
      ? 1
      : 0
  )

  return todos
}

const validate = {
  shared (req) {
    return validator(req, Todo)
  },
  async create (req) {
    let { valid, problems, data } = validate.shared(req)
    if (req.body.key) {
      problems['key'] = { errors: '<p>should not be included on a create</p>' }
    }
    // Insert your custom validation here
    return !valid ? { problems, todo: data } : { todo: data }
  },
  async update (req) {
    let { valid, problems, data } = validate.shared(req)
    // Insert your custom validation here
    return !valid ? { problems, todo: data } : { todo: data }
  }
}

export {
  deleteTodo,
  getTodo,
  getTodos,
  upsertTodo,
  validate
}
