import stateify from './index.js'

function track(info){
    composed.tracking = new Set
    const result = info.callback()
    const dependencies = composed.tracking
    composed.tracking = null
    const controller = new AbortController
    const {signal} = controller
    for(const dependency of dependencies){
        dependency.addEventListener('change', () => {
            controller.abort()
            track(info)
        }, {signal})
    }
    info.result = result
    info.setting = true
    info.root.value.set(stateify.get(result))
    info.setting = false
    return info.root.value
}

export default function composed(callback){
    const root = stateify({})
    const info = {callback, root}
    root.addEventListener('change', ({detail}) => {
        if(info.setting) return
        if(detail.source != root.value) return
        if('value' in root) info.result.set(root.value)
        else info.result.delete()
    })
    return track(info)
}
