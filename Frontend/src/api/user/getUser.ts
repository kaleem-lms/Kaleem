

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


export default async function getUser() {
    const res = await fetch('https://jsonplaceholder.typicode.com/users/1')
        .then(response => response.json())
        .then(data => data)

    return res;
}