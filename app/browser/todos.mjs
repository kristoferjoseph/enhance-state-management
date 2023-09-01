/* global customElements, HTMLElement */
import CustomElement from '@enhance/custom-element'
import MorphdomMixin from '@enhance/morphdom-mixin'
import TodosList from '../elements/todos/list.mjs'
import TodosItem from '../elements/todos/item.mjs'
import API from './api.mjs'
const api = API()

class EnhanceElement extends MorphdomMixin(CustomElement) {
  keys = []
  constructor() {
    super()
    this.api = api
    this.store = api.store
    this.store.subscribe(this.process, this.keys)
  }

  disconnectedCallback() {
    this.store.unsubscribe(this.process)
  }
}

class TodosCreateForm extends HTMLElement {
  constructor() {
    super()
    this.api = api
    this.submit = this.submit.bind(this)
    this.resetForm = this.resetForm.bind(this)
  }

  connectedCallback() {
    this.addEventListener('submit', this.submit)
    this.form = this.querySelector('form')
    this.textInput = this.querySelector('input[type="text"]')
    this.textInput.focus()
  }

  resetForm() {
    this.textInput.value = ''
    this.textInput.focus()
  }

  submit(e) {
    e.preventDefault()
    this.api.create(this.form)
    this.resetForm()
  }
}
customElements.define('todos-create', TodosCreateForm)

class TodosListElement extends EnhanceElement {
  keys = ['todos']
  constructor() {
    super()
  }

  connectedCallback() {
    this.api.list()
  }

  render(args) {
    return TodosList(args)
  }
}
customElements.define('todos-list', TodosListElement)

class TodosItemElement extends EnhanceElement {
  constructor() {
    super()
    this.api = api
    this.update = this.update.bind(this)
    this.updateChecked = this.updateChecked.bind(this)
    this.destroy = this.destroy.bind(this)
    this.shouldCallAPI = this.shouldCallAPI.bind(this)
  }

  connectedCallback() {
    const key = this.getAttribute('key')
    this.updateForm = this.querySelector(`form[action='/todos/${key}']`)
    this.deleteForm = this.querySelector(`form[action='/todos/${key}/delete']`)
    this.updateForm.addEventListener('submit', this.update)
    this.deleteForm.addEventListener('submit', this.destroy)
    this.checkboxInput = this.querySelector('input[type="checkbox"]')
    this.checkboxInput.addEventListener('click', this.updateChecked)
    this.textInput = this.querySelector('input[type="text"]')
    this.textInput.addEventListener('focusout', this.shouldCallAPI)
  }

  static observedAttributes = [
    'key',
    'text',
    'completed'
  ]

  shouldCallAPI(e) {
    // Cuts down on unnecessary API calls
    const text = this.getAttribute('text')
    const value = e.target.value
    if (text !== value) {
      this.update()
    }
  }

  update(e) {
    // Check for the existance of the event so we can call this method from other handlers
    e && e.preventDefault()
    this.api.update(this.updateForm)
  }

  updateChecked(e) {
    e && e.preventDefault()
    // 👆That doesn't really work. Would be nice to be able to set the checked state _before_ making the api call.
    this.update()
  }

  destroy(e) {
    e.preventDefault()
    this.api.destroy(this.deleteForm)
  }

  render(args) {
    return TodosItem(args)
  }

}
customElements.define('todos-item', TodosItemElement)
