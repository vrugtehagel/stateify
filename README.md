# Stateify

A simple way to make state management easy.

Wouldn't it be nice if we could just use a regular object to keep track of our state? And use properties as if they were event targets? Well, now you can!

- [Usage](#usage)
- [The limits](#the-limits)
- [The `change` event](#event)
- [Special methods](#special-methods)
  * [`is`](#special-methods-is)
  * [`get`](#special-methods-get)
  * [`set`](#special-methods-set)
  * [`delete`](#special-methods-delete)
  * [`free`](#special-methods-free)
  * [`typeof`](#special-methods-typeof)
  * [`EventTarget` methods](#special-eventtarget-methods)
- [Tools](#tools)
  * [`stateify.get`](#tools-get)
  * [`stateify.made`](#tools-made)
  * [`stateify.typeof`](#tools-typeof)
- [Composed state variables](#composed-state-variables)
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
data.addEventListener('change', ({detail}) => {
    // update component or whatever you need to do
    console.log(`${detail.key} changed!`)
})

const firstDrink = data.drinks[0]
console.log(firstDrink == 'coffee') // true
data.drinks.push('water') // "drinks changed!"
data.drinks = ['alcohol'] // "drinks changed!"
delete data.favoriteNumber // "favoriteNumber changed!"
console.log(firstDrink == 'alcohol') // true
```


<a name="the-limits"></a>
## The limits

Stateify is intended for state management, and state management only. Anything you provide to the `stateify` function should be data only, no functions. Stateify was created with the intention of stateifying JSON data, so while it _can_ work with more complex data structures, it is not guaranteed to. Specifically, this is referring to objects with getters and setters, class instances, circular references, etcetera.

Secondly, since I believe adding properties or methods to prototypes of built-in objects is a no-go, necessarily the state variables you get are not _actually_ the values they represent. For example, normally, we'd have this:
```js
const data = {
    foo: 'bar'
}
data.foo.addEventListener('change', () => { ... })
// TypeError: data.foo.addEventListener is not a function
```
`data.foo` is just a string, and strings don't have an `addEventListener` method. I don't want to add one, and so state variables are just proxy wrappers around values. They pretend to be the value you'd expect them to be in most cases (through type coercion), but "magically" allow some methods on them that they don't actually have. They type coerce just like the values they represent, and so you can use state variables representing strings and numbers like as if they actually were that. If you're uncomfortable with type coercion, you can always read the type of the variables or "unwrap" the state variable to work with the actual value. However, the type coercion means you can use some state variable in expressions (such as `div.textContent = variable`) and even compare them directly using `==`.
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
One limitation I should explicitly mention are boolean expression. Be careful with these; e.g. even if `foo` is a state variable with the value `false`, `''`, `0`, or `null`, `!foo` will be `false` since `foo` is a proxy, and using that proxy in a boolean expression does not trigger type coercion. This includes operators like `&&` and `||`. If you need to check for falsiness, use [`.get()`](#special-methods-get).

Additionally, the proxies do make looking at values in the console a bit more difficult - the fact that they're proxies means you don't get any autocomplete and just logging e.g. `data.favoriteNumber` will log something like `Proxy {}` (though you can use [`.get()`](#special-methods-get) to read its underlying value).

<a name="event"></a>
## The `change` event

The `change` event is really the main feature of this library. It allows you to listen to changes anywhere in your stateified data structure. Simply listen to the values directly, like so:
```js
const state = stateify({
    drinks: ['coffee', 'tea', 'milk']
})
state.addEventListener('change', () => console.log('state changed!'))
state.drinks.sort() // state changed!
```
The event object here has a `detail` property (like a normal `CustomEvent`) with some data on it; it contains the new value (`detail.value`), and what it was before it changed (`detail.oldValue`). This is the value of the thing you've added the `change` listener to. Additionally, it contains the state variable that fired the change (`detail.source`), as well as the parent object (`detail.parent`) and the key it is under (`detail.key`). This means `detail.parent[detail.key] === detail.source`. Note that in the case of the root changing, `detail.parent` and `detail.key` will both be `null`.

The event bubbles all the way up to the root of the stateified data structure, and any keys that are below the changed value will also fire the `change` event granted their value actually changed. You can use the above properties on the `event.detail` object to figure out what fired the event. For example:
```js
const state = stateify({
    fridge: {
        drinks: ['coffee', 'tea', 'milk'],
        veggiedrawer: []
    },
    freezer: ['pizza']
})
state.fridge.drinks[0].addEventListener('change', () => console.log('drinks changed!'))
state.addEventListener('change', ({detail}) => console.log(`${detail.key} changed!`))
state.fridge.drinks[0] = 'wine' // "drinks changed!", "0 changed!"
state.fridge = {} // "drinks changed!", "fridge changed!"
state.freezer.pop() // "freezer changed!"
```

<a name="special-methods"></a>
## Special methods

These are utility methods any state variable has, that are not actually methods of their value.

<a name="special-methods-is"></a>
### `is`

State variables can be a bit hard to compare because in JavaScript, comparing an object to an object simply checks if the operands point at the same thing in memory. This means you can compare a state variable to a primitive such as `'foo'` or `23` (because it triggers type coercion), but not to an object, which includes `null` and other state variables. For example, `stateify(23) == stateify(23)` returns `false` even though they both represent 23. Instead, you can use `.is()`, which compares the state variable it is called on with the argument. For example:
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
Note that this is a _loose_ comparison; for strict comparison, simply use `variable.get() === value`

<a name="special-methods-get"></a>
### `get`

Gets the underlying value that a state variable represents. Useful for logging, or if you need to do a `===` comparison, or maybe you just want to unwrap a state variable to go back to a normal object/array/primitive.

<a name="special-methods-set"></a>
### `set`

Sets the underlying value. Basically identical to just assinging a property directly, so this is mostly useful for when you're picking properties off an object. For example:
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
// but this would work,
data.favoriteNumber = 3
// and it would be identical to
data.favoriteNumber.set(3)
```

<a name="special-methods-delete"></a>
### `delete`

Essentially the same as `set`, except it does a `delete` operation. That is, `data.foo.delete()` is identical to `delete data.foo`. Like `set`, this allows you to still delete properties even when picking them off an object.

<a name="special-methods-free"></a>
### `free`

State variables are intended to handle changes well, and so stateify tries to be nice. When accessing properties that do not exist, instead of throwing an error, it creates so-called "free" properties. These will simply be `undefined` until the properties gets "filled up" by other changes to the state variable. A bit of code probably explains this a bit better.
```js
const state = stateify({})
const variable = state.foo.bar // normally would throw an error
console.log(variable.is(undefined)) // true
console.log(variable.free()) // true
// we can retroactively define the variable;
state.foo = {bar: 23}
console.log(variable == 23) // true
console.log(variable.free()) // false
```
As can be seen above, `state.foo.bar` does not throw an error even though `state.foo` represents `undefined` (and so normally, accessing `bar` would throw an error). Stateify allows this in order to let you more easily respond to changes in your data structure even while some parts are missing. You can use the `.free()` method to check if the variable is "free", i.e. if normally this value would not exist or be accessible.

<a name="special-methods-typeof"></a>
### `typeof`

Since the `typeof` operator does not work on state variables (they're all proxies, so `typeof` will always evaluate to `'object'`), this is a way to get the type of a value. `variable.typeof()` is a shorthand for `typeof variable.get()`.

<a name="special-eventtarget-methods"></a>
### `EventTarget` methods

Specifically, `addEventListener`, `removeEventListener` and `dispatchEvent`. While state variables are not technically instances of `EventTarget`, these methods pass on their arguments to equivalents on an underlying event target.

<a name="tools"></a>
## Tools

Stateify also provides some very basic tools for you to deal with values that you're not sure are state variables. For example, if you'd like a function or method to be able to take some data in both regular form or as a state variable.

<a name="tools-get"></a>
### `stateify.get`

This unwraps a state variable into the value it represents, or simply returns the value itself if it not a state variable. For example:
```js
const original = {foo: 23}
const state = stateify(original)
console.log(stateify.get(original) === original) // true
console.log(stateify.get(state) === original) // true
console.log(stateify.get(state.foo) === 23) // true
```

<a name="tools-made"></a>
### `stateify.made`

Returns a boolean expressing whether or not the argument provided is a state variable. For example:
```js
const original = {foo: 23}
const state = stateify(original)
console.log(stateify.made(original)) // false
console.log(stateify.made(state)) // true
console.log(stateify.made(state.foo)) // true
```

<a name="tools-typeof"></a>
### `stateify.typeof`

This can be used to detect the type of something, regardless of whether or not it is a state variable. It is a shorthand for `typeof stateify.get(value)`.

<a name="composed-state-variables"></a>
## Composed state variables

Sometimes you'll want to have a value that is dependent on multiple state variables available to you as a state variable itself. Not one you manually change, but one that is composed of others. You can do this by, instead of providing a data structure to `stateify`, providing it with a callback. This callback will create a state variable for you that gets updated anytime its stateified dependencies change. For example:
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

<a name="notes"></a>
## Notes

- State variable are always relative to the root of what you initially passed to `stateify`. This means e.g. `stateify({foo: {bar: 23}}).foo` is not the same thing as `stateify({bar: 23})`.

- Built-in methods on any state variable return non-state variable values. So if `data.drinks` is a state variable for `['coffee', 'tea', 'milk']`, then e.g. `data.drinks.sort()` returns a reference to the _underlying_ array, not `data.drinks` itself.
