 
import { NextRequest } from "next/server"; 
 
const getTargetDomain = (host: string, ownDomain: string) => {
  if(!host.includes(`.${ownDomain}`)) throw new Error('target domain is null');
  const domains = host.split(`.${ownDomain}`);
  return domains[0];
};

export default async function middleware(req: NextRequest) { 
  const url = new URL(req.url);
  const { pathname, host } = url; 

  if (pathname === '/robots.txt') {
    const robots = `User-agent: *
Disallow: /
    `;
    return new Response(robots, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  const ownDomain = process.env.OWN_DOMAIN!;
  let targetDomain;
  try {
    targetDomain = getTargetDomain(host, ownDomain);
  } catch (error) {
    console.error('Error extracting target domain:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
  const origin = `https://${targetDomain}`;
  const actualUrl = `${origin}${pathname}${url.search}${url.hash}`;

  try {
    const response = await fetch(actualUrl, {
      method: req.method,
      headers: req.headers,
      redirect: 'follow'
    });

    let body = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');

    if (contentType && /^(application\/x-javascript|text\/)/i.test(contentType)) {
      let text = new TextDecoder('utf-8').decode(body);

      // Replace all instances of the proxy site domain with the current host domain in the text
      text = text.replace(new RegExp( `(//|https?://)${targetDomain}`, 'g'), `$1${host}` );
      body = new TextEncoder().encode(text).buffer;
    }

    return new Response(body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: ['/', '/:path*']
};
