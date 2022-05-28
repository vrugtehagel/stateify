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
    state.addEventListener('change', () => calls++)
    assert(calls == 0)
    state.drinks.sort()
    assert(calls == 1)
})
Deno.test('the change event (2)', () => {
    let calls = 0
    const state = stateify({
        drinks: ['coffee', 'tea', 'milk']
    })
    state.addEventListener('change', ({detail}) => {
        calls++
        const {parent, key, source} = detail
        assert(parent[key] === source)
    })
    state.drinks.sort()
    state.drinks[0] = 'orange juice'
    state.drinks = ['water']
    assert(calls == 3)
})
Deno.test('the change event (3)', () => {
    let calls = 0
    const state = stateify({
        drinks: ['coffee', 'tea', 'milk']
    })
    state.addEventListener('change', () => calls++)
    state.drinks.addEventListener('change', ({detail}) => {
        if(detail.value == 'beer') detail.stopPropagation()
    })
    assert(calls == 0)
    state.drinks[0] = 'wine'
    assert(calls == 1)
    state.drinks[0] = 'beer'
    assert(calls == 1)
    state.drinks[0] = 'whiskey'
    assert(calls == 2)
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

