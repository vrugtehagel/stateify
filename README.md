# state-variables

Intuitive state management.

Wouldn't it be nice if we could just use a regular object to keep track of our state? And use them as if they were event targets? Well, now you can!


## Usage

This small script provides you with a function to turn any JSON data into a state variable. For example:

```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23
})
```
Then, you can listen to changes to properties simply by adding an event listener like you would with an event target:
```js
data.drinks.addEventListener('change', () => {
    // update component or whatever you need to do
    console.log('drinks changed!')
})

data.drinks.push('water') // "drinks changed!"
data.drinks = ['alcohol'] // "drinks changed!"
```


## The limits

The first thing I should mention is that this only supports valid JSON data, but does not check or convert anything. This means you should not be using any fancy object types, make sure your data does not have any circular references, and does not contain any functions. You can use `JSON.parse(JSON.stringify(data))` to check and/or convert your data.

Secondly, since I refuse to add properties or methods to prototypes of built-in objects, necessarily the state variables you get are not _actually_ the values they represent. For example, normally, we'd have this:
```js
const data = {
    foo: 'bar'
}
data.foo.addEventListener('change', () => { ... })
// TypeError: data.foo.addEventListener is not a function
```
`data.foo` is just a string, and strings don't have an `addEventListener` method. I don't want to add one, and so state variables are just proxy wrappers around values. They pretend to be the value you'd expect them to be in most cases, but "magically" allow some methods on them that they don't actually have. They type coerce just like the values they represent, and so you can generally use them as if they actually were. This means you can use them in expressions and even compare them directly using `==`.
```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23
})
console.log(data.favoriteNumber + 1) // 24
console.log(data.favoriteNumber + '1') // "231"
console.log(data.favoriteNumber == 23) // true
console.log('I\'ve got ' + data.drinks) // "I've got coffee,tea,milk"

// but, since data.favoriteNumber is a proxy and 23 is not,
console.log(data.favoriteNumber === 23) // false
```
Most of the time, you don't have to worry about any of this because things function almost identical to what they represent.

The proxies do make looking at values in the console a bit more difficult - the fact that they're proxies means you don't get any autocomplete and just logging e.g. `data.favoriteNumber` will log something like `Proxy {}` (though you can use `.get()` to read its underlying value).


## Special methods

These are utility methods any state variable has.

### `get`

Gets the underlying value that a state variable represents. Useful for logging, or if you need to do a `===` comparison.

### `set`

Sets the underlying value. Mostly useful for when picking properties off an object. For example:
```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23
})

let {favoriteNumber} = data
favoriteNumber.set(7)
console.log(data.favoriteNumber == 7) // true

// this doesn't work because it just reassigns the variable
favoriteNumber = 3
```

### `delete`

Essentially the same as `set`, except it does a `delete` operation. That is, `data.foo.delete()` is identical to `delete data.foo`. The only difference is that, like `set`, it allows you to still change values when picking properties off an object.

### `EventTarget` methods

Specifically, `addEventListener`, `removeEventListener` and `dispatchEvent`. While state variables are not technically instances of `EventTarget`, these methods pass on their arguments to equivalents on an underlying event target.

## Events

There are three events that come with state variables

### `valuechange`

Fires when a property reference is being reassigned. For example, all of the below fire this event on `data.drinks`:
```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23
})

data.drinks = []
delete data.drinks
data.drinks = 'none'
Object.assign(data, {drinks: ['water']})
```

### `propertychange`

Fires when a property of the value of a property reference changes. Essentially, this means the _contents_ of a value changes. For example:
```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    preferences: {
        blackCoffee: false
    }
})

data.drinks[2] = 'water'
data.drinks.push('juice')
data.drinks.sort()
data.preferences.earlGrey = true
delete data.preferences
Object.assign(data, {preferences: {}})
```
The above all fire the `propertychange` event on `data.drinks` and `data.preferences` (on whichever is being modified, of course). Note that these event listeners are _not_ tied to the object itself, but rather to the value of the property reference. This means:
```js
import stateify from 'state-variables'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
})

data.drinks.addEventListener('propertychange', () => console.log('Drinks changed!'))
data.drinks.push('water') // "Drinks changed!"

// now we hold a reference to the older array and reassign data.drinks
const olderReference = data.drinks
data.drinks = ['alcohol']

olderReference.push('juice') // doesn't log anything
data.drinks.push('water') // "Drinks changed!"
```

### `change`
Lastly, we've got the `change` event, which fires whenever either `valuechange` or `propertychange` does. This event is identical to `valuechange` for primitive values (because those will never fire `propertychange`). Most often you'll probably want to use this.
