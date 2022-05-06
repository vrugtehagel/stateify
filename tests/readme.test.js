import { assert } from "https://deno.land/std@0.132.0/testing/asserts.ts";
import stateify from '../index.js'

Deno.test('usage', () => {
    let calls = 0
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteNumber: 23
    })
    data.drinks.addEventListener('change', () => calls++)
    data.drinks.push('water')
    assert(calls == 1)
    data.drinks = ['alcohol']
    assert(calls == 2)
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
Deno.test('valuechange', () => {
    let calls = 0
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        favoriteNumber: 23
    })
    data.drinks.addEventListener('valuechange', () => calls++)
    data.drinks = []
    assert(calls == 1)
    delete data.drinks
    assert(calls == 2)
    data.drinks = 'none'
    assert(calls == 3)
    Object.assign(data, {drinks: ['water']})
    assert(calls == 4)
})
Deno.test('propertychange', () => {
    let calls = 0
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk'],
        preferences: {
            blackCoffee: false
        }
    })
    data.drinks.addEventListener('propertychange', () => calls++)
    data.preferences.addEventListener('propertychange', () => calls++)
    data.drinks[2] = 'water'
    assert(calls == 1)
    data.drinks.push('juice')
    assert(calls == 2)
    data.drinks.sort()
    assert(calls == 3)
    data.preferences.earlGrey = true
    assert(calls == 4)
    delete data.preferences.blackCoffee
    assert(calls == 5)
    Object.assign(data.preferences, {delicious: true})
    assert(calls == 6)
})
Deno.test('more propertychange', () => {
    let calls = 0
    const data = stateify({
        drinks: ['coffee', 'tea', 'milk']
    })

    data.drinks.addEventListener('propertychange', () => calls++)
    data.drinks.push('water')
    assert(calls == 1)
    const olderReference = stateify(data.drinks.get())
    data.drinks = ['alcohol']
    olderReference.push('juice')
    assert(calls == 1)
    data.drinks.push('water')
    assert(calls == 2)
})
Deno.test('notes 1', () => {
    const object = {foo: 'bar'}
    assert(stateify(object) === stateify(object))
})
Deno.test('notes 2', () => {
    const drinks = ['coffee', 'tea', 'milk']
    const data = stateify({drinks})
    assert(data.drinks.sort() == drinks)
})

