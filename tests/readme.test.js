import { assert } from "https://deno.land/std@0.132.0/testing/asserts.ts";
import stateify from '../index.js'

Deno.test('usage', () => {
    let calls = 0
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteNumber: 23
    })
    data.addEventListener('change', ({detail}) => {
        calls++
        if(calls == 1) assert(detail.key == 'drinks')
        if(calls == 2) assert(detail.key == 'drinks')
        if(calls == 3) assert(detail.key == 'favoriteNumber')
    })

    const firstDrink = data.drinks[0]
    assert(firstDrink == 'coffee')
    data.drinks.push('water')
    data.drinks = ['alcohol']
    delete data.favoriteNumber
    assert(firstDrink == 'alcohol')
})
Deno.test('limits', () => {
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteNumber: 23,
        preferences: null
    })
    assert(data.favoriteNumber + 1 === 24)
    assert(data.favoriteNumber + '1' === '231')
    assert(data.favoriteNumber == 23)
    assert('I\'ve got ' + data.drinks === 'I\'ve got coffee,tea,milk')
    assert(data.favoriteNumber !== 23)
    assert(data.preferences != null)
    assert(data.preferences.is(null))
})
Deno.test('the change event (1)', () => {
    let calls = 0
    const state = stateify({
        drinks: ['coffee', 'tea', 'milk']
    })
    state.drinks.addEventListener('change', () => calls++)
    assert(calls == 0)
    state.drinks.sort()
    assert(calls == 1)
})
Deno.test('the change event (2)', () => {
    let calls = 0
    let drinksCalls = 0
    const state = stateify({
        fridge: {
            drinks: ['coffee', 'tea', 'milk'],
            veggiedrawer: []
        },
        freezer: ['pizza']
    })
    state.fridge.drinks[0].addEventListener('change', () => drinksCalls++)
    state.addEventListener('change', ({detail}) => {
        calls++
        if(calls == 1) assert(detail.key == '0')
        if(calls == 2) assert(detail.key == 'fridge')
        if(calls == 3) assert(detail.key == 'freezer')
    })
    state.fridge.drinks[0] = 'wine'
    assert(calls == 1)
    assert(drinksCalls == 1)
    state.fridge = {}
    assert(calls == 2)
    assert(drinksCalls == 2)
    state.freezer.pop()
    assert(calls == 3)
    assert(drinksCalls == 2)
})
Deno.test('is', () => {
    const data = stateify({
        rgb: ['230', '191', '00'],
        red: 230,
        green: 191,
        blue: 0,
        alpha: null
    })
    assert(data.rgb[0].is(data.red))
    assert(data.alpha.is(null))
})
Deno.test('set', () => {
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteNumber: 23
    })
    let {favoriteNumber} = data
    favoriteNumber.set(7)
    assert(data.favoriteNumber == 7)
})
Deno.test('free', () => {
    const state = stateify({})
    const variable = state.foo.bar
    assert(variable.is(undefined))
    assert(variable.free())
    state.foo = {bar: 23}
    assert(variable == 23)
    assert(!variable.free())
})
Deno.test('EventTarget methods', () => {
    const state = stateify({foo: 'bar'})
    assert(state instanceof EventTarget)
    assert(state.foo instanceof EventTarget)
})
Deno.test('stateify.get', () => {
    const original = {foo: 23}
    const state = stateify(original)
    assert(stateify.get(original) === original)
    assert(stateify.get(state) === original)
    assert(stateify.get(state.foo) === 23)
})
Deno.test('stateify.made', () => {
    const original = {foo: 23}
    const state = stateify(original)
    assert(!stateify.made(original))
    assert(stateify.made(state))
    assert(stateify.made(state.foo))
})
Deno.test('composed state variables', () => {
    let calls = 0
    const state = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteIndex: 1
    })
    const favoriteDrink = stateify(() => state.drinks[state.favoriteIndex])
    favoriteDrink.addEventListener('change', () => calls++)
    state.drinks[1] = 'water'
    assert(calls == 1)
    assert(favoriteDrink == 'water')
    state.favoriteIndex = 0
    assert(calls == 2)
    assert(favoriteDrink == 'coffee')
})
Deno.test('notes (1)', () => {
    const drinks = ['coffee', 'tea', 'milk']
    const state = stateify(drinks)
    assert(state.sort() == drinks)
})

