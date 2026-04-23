console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
let nav = document.createElement('nav');
document.body.prepend(nav);

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' }
  ];

for (let p of pages) {
    let url = p.url;
    let title = p.title;
  
    const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      ? "/"
      : "/portfolio/";
  
    if (!url.startsWith('http')) {
      url = BASE_PATH + url;
    }
  
    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;

    a.classList.toggle(
        'current',
        a.host === location.host && a.pathname === location.pathname
      );

    if (a.host !== location.host) {
        a.target = "_blank";
    }
    nav.append(a);
  }

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>`,
  );


const select = document.querySelector('select');

if ("colorScheme" in localStorage){
  const saved = localStorage.colorScheme;
  document.documentElement.style.setProperty("color-scheme", saved);
  select.value = saved;
}

select.addEventListener('input', function (event) {
  const value = event.target.value;
  console.log('color scheme changed to', event.target.value);

  //change color scheme
  document.documentElement.style.setProperty('color-scheme', event.target.value);
  localStorage.colorScheme = value;
  

});


const form = document.querySelector('form');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);

  let url = form.action + "?";
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  url += params.join("&");

  location.href = url;
});


export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

