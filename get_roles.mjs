import fs from 'fs';
import path from 'path';

function getEnv(dir) {
    try {
        const envPath = path.join(dir, '.env');
        const content = fs.readFileSync(envPath, 'utf8');
        const urlMatch = content.match(/VITE_SUPABASE_URL=(.+)/);
        const keyMatch = content.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
        return {
            url: urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : null,
            key: keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : null
        }
    } catch(e) {
        return { url: null, key: null };
    }
}

const env = getEnv('.');

async function fetchRoles() {
    console.log("URL:", env.url);
    const res = await fetch(`${env.url}/rest/v1/user_roles?select=*`, {
        headers: {
            'apikey': env.key,
            'Authorization': `Bearer ${env.key}`
        }
    });
    const data = await res.json();
    console.log("User Roles count:", data.length);
    console.log("Roles:", data);
}
fetchRoles();
