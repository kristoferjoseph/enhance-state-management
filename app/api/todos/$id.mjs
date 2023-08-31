// View documentation at: https://enhance.dev/docs/learn/starter-project/api
/**
  * @typedef {import('@enhance/types').EnhanceApiFn} EnhanceApiFn
  */
import { getTodo, upsertTodo, validate } from '../../models/todos.mjs'


/**
 * @type {EnhanceApiFn}
 */
export async function get (req) {
  if (req.session.problems) {
    let { problems, todo, ...session } = req.session
    return {
      session,
      json: { problems, todo }
    }
  }

  const id = req.pathParameters?.id
  const result = await getTodo(id)
  return {
    json: { todo: result }
  }
}

/**
 * @type {EnhanceApiFn}
 */
export async function post (req) {
  const id = req.pathParameters?.id

  const session = req.session
  // Validate
  let { problems, todo } = await validate.update(req)
  if (problems) {
    return {
      session: {...session, problems, todo },
      json: { problems, todo },
      location: `/todos/${todo.key}`
    }
  }

  // eslint-disable-next-line no-unused-vars
  let { problems: removedProblems, todo: removed, ...newSession } = session
  try {
    const result = await upsertTodo({ key: id, ...todo })
    return {
      session: newSession,
      json: { todo: result },
      location: '/todos'
    }
  }
  catch (err) {
    return {
      session: { ...newSession, error: err.message },
      json: { error: err.message },
      location: '/todos'
    }
  }
}
