import {getEnvironnement} from "./getEnvironnement";

test('beta tag', async () => {
    await expect(getEnvironnement('2021-08-12T21-08-45Z-beta')).toBe('beta');
});


test('prod tag', async () => {
    await expect(getEnvironnement('2021-08-12T21-08-45Z-prod')).toBe('prod');
});


test('feature branch', async () => {
    await expect(() => getEnvironnement('refs/head/my-feature')).toThrow('The branch is not main or master');
});


test('main branch (dev env)', async () => {
    await expect(getEnvironnement('refs/heads/main')).toBe('dev');
});


test('master branch (dev env)', async () => {
    await expect(getEnvironnement('refs/heads/master')).toBe('dev');
});


test('feature branch look like a prod tag', async () => {
    await expect(() => getEnvironnement('refs/heads/my-feature-for-prod')).toThrow('The branch is not main or master');
});
