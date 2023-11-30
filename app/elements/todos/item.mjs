export default function TodosItem({ html, state }) {
  const { attrs={} } = state
  const { created='', key='', text='' } = attrs
  const checked = Object.keys(attrs).includes('completed')
    ? 'checked'
    : ''

  return html`
    <style>
      :host {
        display: flex;
      }
      .bg-transparent {
        background-color: transparent;
      }
    </style>
    <form
     action="/todos/${key}"
     class="
      flex
      flex-grow
      justify-content-around
      pi0
     "
     method="POST"
    >
      <input
        id="check-${key}"
        type="checkbox"
        name="completed"
        class="
         flex
         items-center
        "
        ${checked}
      ></input>
      <input
        type="text"
        name="text"
        value="${text}"
        class="
          flex-grow
          mi0
          p-2
          radius0
          bg-transparent
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
