# Some random D&D note thing

Storing and displaying the structure of a D&D (5E 2014 [probably also works for 2024 if you really insist]) dungeon in TypeDB.

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

## Possible future TODOs

- Support data input/editing through the UI
- Support PCs better, would be cool to be able to track the party's progress through the dungeon
- Tell AI to update the data model to use AD&D 1E instead and see how it handles a TTRPG that isn't the probably most talked about TTRPG on the internet by a factor of 100 or something 
