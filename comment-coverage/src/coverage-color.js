/** Get coverage color from percentage. */
export function getCoverageColor(percentage) {
    // https://shields.io/category/coverage
    const rangeColors = [{
        color: 'red', range: [0, 40],
    }, {
        color: 'orange', range: [40, 60],
    }, {
        color: 'yellow', range: [60, 80],
    }, {
        color: 'green', range: [80, 101],
    }]

    const {color} = rangeColors.find(({range: [min, max]}) => percentage >= min && percentage < max) || rangeColors[0]

    return color
}
