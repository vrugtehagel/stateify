# Stateify

A simple way to make state management easy.

Wouldn't it be nice if we could just use a regular object to keep track of our state? And use properties as if they were event targets? Well, now you can!

- [Usage](#usage)
- [The limits](#the-limits)
- [Composed state variables](#composed-state-variables)
- [Special methods](#special-methods)
  * [`is`](#special-methods-is)
  * [`get`](#special-methods-get)
  * [`set`](#special-methods-set)
  * [`delete`](#special-methods-delete)
  * [`typeof`](#special-methods-typeof)
  * [`EventTarget` methods](#special-eventtarget-methods)
- [Events](#events)
  * [`valuechange`](#events-valuechange)
  * [`propertychange`](#events-propertychange)
  * [`change`](#events-change)
- [Notes](#notes)


<a name="usage"></a>
## Usage

This small script provides you with a function to turn any JSON data into a _state variable_. For example:

```js
import stateify from 'stateify'

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


<a name="the-limits"></a>
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
`data.foo` is just a string, and strings don't have an `addEventListener` method. I don't want to add one, and so state variables are just proxy wrappers around values. They pretend to be the value you'd expect them to be in most cases, but "magically" allow some methods on them that they don't actually have. They type coerce just like the values they represent, and so you can generally use them as if they actually were. This means you can use them in expressions and in some cases even compare them directly using `==`.
```js
import stateify from 'stateify'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23,
    preferences: null
})
console.log(data.favoriteNumber + 1) // 24
console.log(data.favoriteNumber + '1') // "231"
console.log(data.favoriteNumber == 23) // true
console.log('I\'ve got ' + data.drinks) // "I've got coffee,tea,milk"

// but, since data.favoriteNumber is a proxy and 23 is not,
console.log(data.favoriteNumber === 23) // false
// and things like this also don't work, because comparing an object to
// an object just checks if they point at the same object in memory
console.log(data.preferences == null) // false
console.log(data.preferences.is(null)) // true
```
Most of the time, you don't have to worry about any of this because state variables act like they _are_ the value they hold in nearly all cases.

The proxies do make looking at values in the console a bit more difficult - the fact that they're proxies means you don't get any autocomplete and just logging e.g. `data.favoriteNumber` will log something like `Proxy {}` (though you can use [`.get()`](#special-methods-get) to read its underlying value).


<a name="composed-state-variables"></a>
## Composed state variables

Sometimes you'll want to have a value that is dependent on multiple state variables available to you as a state variable itself. Not one you manually change, but one that is composed of others. You can do this by, instead of providing a JSON structure to `stateify`, providing it with a callback. This callback will create a state variable for you that gets updated anytime its stateified dependencies change. For example:
```js
const state = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteIndex: 1
})
const favoriteDrink = stateify(() => state.drinks[state.favoriteIndex])
favoriteDrink.addEventListener('change', () => console.log('changed!'))
state.drinks[1] = 'water' // changed!
console.log(favoriteDrink == 'water') // true
state.favoriteIndex = 0 // changed!
console.log(favoriteDrink == 'coffee') // true
```
While you can still change the composed variable's value using methods like `set` and `delete`, you should not do this; the variable will update any time its stateified dependencies change, even if it has been set to a different value manually.

<a name="special-methods"></a>
## Special methods

These are utility methods any state variable has, that are not actually methods of their value.

<a name="special-methods-is"></a>
### `is`

State variables can be a bit hard to compare because in JavaScript, comparing an object to an object simply checks if the operands point at the same thing in memory. This means you can compare a state variable to a primitive such as `'foo'` or `23`, but not to an object, which includes other state variables. For example, `stateify(23) == stateify(23)` returns `false` even though they both represent 23. Instead, you can use `.is()`, which compares the state variable it is called on with the argument. For example:
```js
const data = stateify({
    rgb: ['230', '191', '00'],
    red: 230,
    green: 191,
    blue: 0,
    alpha: null
})
console.log(data.rgb[0].is(data.red)) // true
console.log(data.alpha.is(null)) // true
```

<a name="special-methods-get"></a>
### `get`

Gets the underlying value that a state variable represents. Useful for logging, or if you need to do a `===` comparison, or maybe you just want to unwrap a state variable to go back to a normal object/array/primitive.

<a name="special-methods-set"></a>
### `set`

Sets the underlying value. Mostly useful for when you're picking properties off an object. For example:
```js
import stateify from 'stateify'

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

<a name="special-methods-delete"></a>
### `delete`

Essentially the same as `set`, except it does a `delete` operation. That is, `data.foo.delete()` is identical to `delete data.foo`. Like `set`, this allows you to still delete properties even when picking them off an object.

<a name="special-methods-typeof"></a>
### `typeof`

Since the `typeof` operator does not work on state variables (they're all proxies, so `typeof` will always evaluate to `'object'`), this is a way to get the type of a value. `variable.typeof()` is a shorthand for `typeof variable.get()`.

<a name="special-eventtarget-methods"></a>
### `EventTarget` methods

Specifically, `addEventListener`, `removeEventListener` and `dispatchEvent`. While state variables are not technically instances of `EventTarget`, these methods pass on their arguments to equivalents on an underlying event target.

<a name="events"></a>
## Events

There are three events that come with state variables.

<a name="events-valuechange"></a>
### `valuechange`

Fires when a property reference is being reassigned. For example, all of the below fire this event on `data.drinks`:
```js
import stateify from 'stateify'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk'],
    favoriteNumber: 23
})

data.drinks = []
delete data.drinks
data.drinks = 'none'
Object.assign(data, {drinks: ['water']})
```

<a name="events-propertychange"></a>
### `propertychange`

Fires when a property of the value of a property reference changes. Essentially, this means the _contents_ of a value changes, while the value itself stays the same (and as such it is only applicable to objects). For example:
```js
import stateify from 'stateify'

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
delete data.preferences.blackCoffee
Object.assign(data.preferences, {delicious: true})
```
The above all fire the `propertychange` event on `data.drinks` and `data.preferences` (on whichever is being modified, of course). Note that these event listeners are _not_ tied to the object itself, but rather to the value of the property reference. Essentially,
```js
import stateify from 'stateify'

const data = stateify({
    drinks: ['coffee', 'tea', 'milk']
})

data.drinks.addEventListener('propertychange', () => console.log('Drinks changed!'))
data.drinks.push('water') // "Drinks changed!"

// now we hold a reference to the older array and reassign data.drinks
const olderReference = stateify(data.drinks.get())
data.drinks = ['alcohol']

olderReference.push('juice') // doesn't log anything
data.drinks.push('water') // "Drinks changed!"
```

<a name="events-change"></a>
### `change`

Lastly, we've got the `change` event, which fires whenever either `valuechange` or `propertychange` does. This event is identical to `valuechange` for primitive values (because those will never fire `propertychange`). Most often this is probably the event you'll want to use.


<a name="notes"></a>
## Notes

- Wrapping the same object in a state variable in different places does _not_ create a different state variable. When providing the same reference, it will result in the exact same state variable. In short, `stateify(object) === stateify(object)`.

- Built-in methods on any state variable return non-state variable values. So if `data.drinks` is a state variable for `['coffee', 'tea', 'milk']`, then e.g. `data.drinks.sort()` returns a reference to the _underlying_ array, not `data.drinks` itself.
