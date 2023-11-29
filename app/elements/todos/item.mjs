export default function TodosItem({ html, state }) {
  const { attrs={} } = state
  const { created='', key='', text='' } = attrs
  const checked = Object.keys(attrs).includes('completed')
    ? 'checked'
    : ''

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
