# Some random D&D note thing

Storing and displaying the structure of a D&D (5E 2014) dungeon in TypeDB.

## Setup

- Run TypeDB
- Load the schema file (`data/schema.tql`)

## Running the app

- `cd frontend`
- `npm start`

## Connecting

On navigating to the app, you should be redirected to a page to input TypeDB connection information

## Example data

- Two example data files are provided:
  - `example.tql`
  - `yondergate.tql`

The first based on nothing really, the second based on The Yondergate by Steve Kilian

From experience, AI agents do an okay job of generating new data if you provide them these examples and point them at a PDF - 
room connections are pretty not-great though
