const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactInfo {
  web: string | null;
  telefono: string | null;
  email: string | null;
  redesSociales: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
  } | null;
}

interface EnrichRequest {
  businessName: string;
  ciudad: string;
  existingContact: ContactInfo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { businessName, ciudad, existingContact }: EnrichRequest = await req.json();

    if (!businessName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Business name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured', contact: existingContact }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count existing contact methods
    const countContacts = (contact: ContactInfo): number => {
      let count = 0;
      if (contact.web) count++;
      if (contact.telefono) count++;
      if (contact.email) count++;
      if (contact.redesSociales) {
        const redes = contact.redesSociales;
        if (redes.instagram) count++;
        if (redes.facebook) count++;
        if (redes.twitter) count++;
        if (redes.linkedin) count++;
        if (redes.youtube) count++;
        if (redes.tiktok) count++;
      }
      return count;
    };

    // If we already have 2+ contact methods, skip enrichment
    if (countContacts(existingContact) >= 2) {
      console.log(`${businessName}: Already has ${countContacts(existingContact)} contact methods, skipping enrichment`);
      return new Response(
        JSON.stringify({ success: true, contact: existingContact, enriched: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching contact info for: ${businessName} in ${ciudad}`);

    // Search for the business using Firecrawl
    const searchQuery = `"${businessName}" ${ciudad} contacto teléfono email`;
    
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        lang: 'es',
        country: 'es',
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('Firecrawl search error:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Search failed', contact: existingContact }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const results = searchData.data || [];

    console.log(`Found ${results.length} search results for ${businessName}`);

    // Extract contact info from search results
    const enrichedContact: ContactInfo = { ...existingContact };
    enrichedContact.redesSociales = enrichedContact.redesSociales || {};

    for (const result of results) {
      const content = (result.markdown || '') + ' ' + (result.description || '') + ' ' + (result.url || '');
      const url = result.url || '';

      // Extract website (prefer the main domain if it looks like the business site)
      if (!enrichedContact.web && url) {
        const businessNameLower = businessName.toLowerCase().replace(/\s+/g, '');
        const urlLower = url.toLowerCase();
        
        // Check if URL might be the business's own website
        if (urlLower.includes(businessNameLower.substring(0, 5)) || 
            !urlLower.includes('google') && 
            !urlLower.includes('facebook') && 
            !urlLower.includes('instagram') &&
            !urlLower.includes('tripadvisor') &&
            !urlLower.includes('yelp') &&
            !urlLower.includes('paginasamarillas')) {
          enrichedContact.web = url;
        }
      }

      // Extract phone numbers (Spanish format)
      if (!enrichedContact.telefono) {
        const phonePatterns = [
          /(?:\+34\s?)?(?:6|7|8|9)\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g,
          /(?:\+34\s?)?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/g,
          /Tel[éeó]?f?[ono]*[:.]\s*([+\d\s.-]+)/gi,
        ];
        
        for (const pattern of phonePatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            // Clean the phone number
            let phone = matches[0].replace(/Tel[éeó]?f?[ono]*[:.]\s*/gi, '').trim();
            phone = phone.replace(/[\s.-]/g, '');
            if (phone.length >= 9 && phone.length <= 12) {
              enrichedContact.telefono = phone;
              break;
            }
          }
        }
      }

      // Extract email
      if (!enrichedContact.email) {
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = content.match(emailPattern);
        if (emails && emails.length > 0) {
          // Filter out common non-business emails
          const validEmail = emails.find(e => 
            !e.includes('example') && 
            !e.includes('noreply') && 
            !e.includes('newsletter')
          );
          if (validEmail) {
            enrichedContact.email = validEmail;
          }
        }
      }

      // Extract social media - only save valid URLs
      const socialPatterns = {
        instagram: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/i,
        facebook: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)\/?/i,
        twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/i,
        linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company\/|in\/)([a-zA-Z0-9-]+)\/?/i,
        youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)\/?/i,
        tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?/i,
      };

      for (const [network, pattern] of Object.entries(socialPatterns)) {
        if (!enrichedContact.redesSociales![network as keyof typeof enrichedContact.redesSociales]) {
          const match = content.match(pattern);
          if (match && match[0]) {
            // Validate it's a proper URL
            const url = match[0];
            if (url.startsWith('http://') || url.startsWith('https://')) {
              enrichedContact.redesSociales![network as keyof typeof enrichedContact.redesSociales] = url;
            }
          }
        }
      }

      // If we have enough contact methods, stop searching
      if (countContacts(enrichedContact) >= 2) {
        break;
      }
    }

    // If still no website, try to scrape the first non-directory result
    if (!enrichedContact.web && results.length > 0) {
      for (const result of results) {
        const url = result.url || '';
        if (url && 
            !url.includes('google') && 
            !url.includes('facebook') && 
            !url.includes('tripadvisor') &&
            !url.includes('paginasamarillas')) {
          enrichedContact.web = url;
          break;
        }
      }
    }

    // Clean up empty social media object
    if (enrichedContact.redesSociales && 
        !Object.values(enrichedContact.redesSociales).some(Boolean)) {
      enrichedContact.redesSociales = null;
    }

    const finalCount = countContacts(enrichedContact);
    console.log(`${businessName}: Enriched to ${finalCount} contact methods`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contact: enrichedContact, 
        enriched: true,
        contactCount: finalCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enriching contact:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to enrich contact';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
