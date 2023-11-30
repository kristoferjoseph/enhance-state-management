# Enhance state management

This repo is a demonstration of the recommended architecture for fullstack state management in an Enhance application.

This example works with and without JavaScript enabled.

The example todo app reuses custom element templates for the server and the browser.
It is progressively enhanced from working forms that refresh the page when submitted to Custom Elements that react to user input and update the application state via API calls to persist data to the database.

The API offloads the backend calls to a Worker that will make data fetches off of the UI thread allowing the UI layer to remain responsive as the data is fetched in the background.
