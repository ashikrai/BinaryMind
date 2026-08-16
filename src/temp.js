// async function validateMediumToken(token) {
//   const response = await fetch('https://api.medium.com/v1/me', {
//     method: 'GET',
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json',
//       'Accept': 'application/json'
//     }
//   });

//   if (response.ok) {
//     const { data } = await response.json();
//     console.log('Token is valid. User ID:', data);
//     return true;
//   }

//   console.error(`Token invalid (${response.status})`);
//   return false;
// }
const MEDIUM_API = "https://api.medium.com/v1";
/** Proxy base. Override with VITE_MEDIUM_PROXY_URL env var. */
const PROXY = ("") ?? "";


async function mediumGet(path, token){
  const url = MEDIUM_API + path
  const res = await fetch('https://api.medium.com/v1/me', {
    method: 'GET',
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });
  if (res.ok) {
    const { data } = await res.json();
    console.log("resp: ",data)
    console.log("resp1: ",JSON.stringify(data))
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Medium API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}


// validateMediumToken("2454a9e15b1adcf523e08db79d4fe91a0a0ce6a59464241f4b52bb49b92bfc12b")
mediumGet("me","2454a9e15b1adcf523e08db79d4fe91a0a0ce6a59464241f4b52bb49b92bfc12b")