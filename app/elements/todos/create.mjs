export default function TodosCreate({ html, state }) {
  const { instanceID='' } = state

  return html`
<style>
  .bg-transparent {
    background-color: transparent;
  }
</style>
<form
  action="/"
  method="POST"
  class="flex"
>
    <label
      for="text-${instanceID}"
      class="flex-grow"
    >
      <input
        id="text-${instanceID}"
        class="
         si-100
         p-2
         border1
         border-solid
         border-current
         radius0
         overflow-hidden
         bg-transparent
        "
        name="text"
        type="text"
        placeholder="Add a title ⏎"
        autofocus
        required
      >
    </label>
</form>
  `
}
