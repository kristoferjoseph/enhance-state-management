// View documentation at: https://enhance.dev/docs/learn/starter-project/api
import { deleteTodo } from '../../../models/todos.mjs'


/**
 * @type {import('@enhance/types').EnhanceApiFn}
 */
export async function post (req) {
  const id = req.pathParameters?.id

  const session = req.session
  // eslint-disable-next-line no-unused-vars
  let { problems: removedProblems, todo: removed, ...newSession } = session
  try {
    let todo = await deleteTodo(id)
    return {
      session: newSession,
      json: { todo },
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
