// github-agent.ts
import { 
  BotAgent, 
  ManifestOptions, 
  UtteranceEvent, 
  Envelope,
  createTextUtterance,
  isUtteranceEvent
} from '@openfloor/protocol';

interface GitHubRepo {
  name: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  language: string;
  updated_at: string;
  html_url: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

/**
 * GitHubAgent - Technology trends and adoption research agent
 */
export class GitHubAgent extends BotAgent {
  private readonly baseUrl = 'https://api.github.com';
  private readonly rateLimitDelay = 2000; // 2 seconds
  private lastRequestTime = 0;

  constructor(manifest: ManifestOptions) {
    super(manifest);
  }

  async processEnvelope(inEnvelope: Envelope): Promise<Envelope> {
    const responseEvents: any[] = [];

    for (const event of inEnvelope.events) {
      const addressedToMe = !event.to || 
        event.to.speakerUri === this.speakerUri || 
        event.to.serviceUrl === this.serviceUrl;

      if (addressedToMe && isUtteranceEvent(event)) {
        const responseEvent = await this._handleTechQuery(event, inEnvelope);
        if (responseEvent) responseEvents.push(responseEvent);
      } else if (addressedToMe && event.eventType === 'getManifests') {
        responseEvents.push({
          eventType: 'publishManifests',
          to: { speakerUri: inEnvelope.sender.speakerUri },
          parameters: {
            servicingManifests: [this.manifest.toObject()]
          }
        });
      }
    }

    return new Envelope({
      schema: { version: inEnvelope.schema.version },
      conversation: { id: inEnvelope.conversation.id },
      sender: {
        speakerUri: this.speakerUri,
        serviceUrl: this.serviceUrl
      },
      events: responseEvents
    });
  }

  private async _handleTechQuery(event: UtteranceEvent, inEnvelope: Envelope): Promise<any> {
    try {
      const dialogEvent = event.parameters?.dialogEvent as { features?: any };
      if (!dialogEvent?.features?.text?.tokens?.length) {
        return createTextUtterance({
          speakerUri: this.speakerUri,
          text: "🔧 I need a technology or framework name to research on GitHub!",
          to: { speakerUri: inEnvelope.sender.speakerUri }
        });
      }

      const technology = dialogEvent.features.text.tokens
        .map((token: any) => token.value)
        .join('');

      // Check if this looks like a tech query
      if (!this._isTechQuery(technology)) {
        return createTextUtterance({
          speakerUri: this.speakerUri,
          text: "🔧 I specialize in technology trends. Try queries about programming frameworks, libraries, tools, or development technologies.",
          to: { speakerUri: inEnvelope.sender.speakerUri }
        });
      }

      const results = await this._searchGitHub(technology);
      
      return createTextUtterance({
        speakerUri: this.speakerUri,
        text: results,
        to: { speakerUri: inEnvelope.sender.speakerUri }
      });

    } catch (error) {
      console.error('Error in GitHub research:', error);
      return createTextUtterance({
        speakerUri: this.speakerUri,
        text: "🔧 I encountered an error while searching GitHub. Please try again with a different technology name.",
        to: { speakerUri: inEnvelope.sender.speakerUri }
      });
    }
  }

  private async _searchGitHub(technology: string, maxResults = 5): Promise<string> {
    await this._rateLimit();

    try {
      const searchQuery = `${technology}`;
      
      const params = new URLSearchParams({
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: maxResults.toString()
      });

      const response = await fetch(`${this.baseUrl}/search/repositories?${params}`, {
        headers: {
          'User-Agent': 'OpenFloor GitHub Research Agent',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json() as GitHubSearchResponse;

      if (!data.items || data.items.length === 0) {
        return `**GitHub Technology Research for: ${technology}**\n\nNo relevant repositories found.`;
      }

      let result = `**GitHub Technology Trends for: ${technology}**\n\n`;
      
      // Repository analysis
      result += this._formatRepositoryData(data.items, technology);
      
      // Trend analysis
      result += this._analyzeTechnologyTrends(data, technology);
      
      // Recent activity analysis
      result += this._analyzeRecentActivity(data.items, technology);
      
      return result;

    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return `**GitHub Technology Research for: ${technology}**\n\nRequest timeout - GitHub may be experiencing high load. Technology data available but slower than expected.`;
      }
      throw error;
    }
  }

  private _formatRepositoryData(repositories: GitHubRepo[], technology: string): string {
    let result = `**Top ${repositories.length} Repositories:**\n`;
    
    repositories.forEach((repo, index) => {
      const stars = repo.stargazers_count.toLocaleString();
      const forks = repo.forks_count.toLocaleString();
      const updated = repo.updated_at.substring(0, 10); // YYYY-MM-DD
      
      result += `**${index + 1}. ${repo.name}** (${stars} ⭐, ${forks} 🍴)\n`;
      result += `   Language: ${repo.language || 'Unknown'} | Updated: ${updated}\n`;
      
      let description = repo.description || 'No description';
      if (description.length > 100) {
        description = description.substring(0, 100) + '...';
      }
      result += `   Description: ${description}\n`;
      result += `   URL: ${repo.html_url}\n\n`;
    });
    
    return result;
  }

  private _analyzeTechnologyTrends(data: GitHubSearchResponse, technology: string): string {
    const totalCount = data.total_count;
    const items = data.items;
    
    if (!items.length) return '';
    
    // Calculate adoption metrics
    const totalStars = items.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = items.reduce((sum, repo) => sum + repo.forks_count, 0);
    const avgStars = Math.round(totalStars / items.length);
    
    // Determine adoption level
    let adoptionLevel: string;
    if (totalCount > 50000) {
      adoptionLevel = 'Very High';
    } else if (totalCount > 10000) {
      adoptionLevel = 'High';
    } else if (totalCount > 1000) {
      adoptionLevel = 'Moderate';
    } else if (totalCount > 100) {
      adoptionLevel = 'Emerging';
    } else {
      adoptionLevel = 'Niche';
    }
    
    // Language analysis
    const languages: { [key: string]: number } = {};
    items.forEach(repo => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    });
    
    let result = `**Technology Adoption Analysis:**\n`;
    result += `• Total repositories: ${totalCount.toLocaleString()}\n`;
    result += `• Adoption level: ${adoptionLevel}\n`;
    result += `• Average stars (top repos): ${avgStars.toLocaleString()}\n`;
    result += `• Total community engagement: ${totalStars.toLocaleString()} stars, ${totalForks.toLocaleString()} forks\n`;
    
    if (Object.keys(languages).length > 0) {
      const topLanguages = Object.entries(languages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      result += `• Popular languages: ${topLanguages.map(([lang, count]) => `${lang} (${count})`).join(', ')}\n`;
    }
    
    result += '\n';
    return result;
  }

  private _analyzeRecentActivity(repositories: GitHubRepo[], technology: string): string {
    if (!repositories.length) return '';
    
    const currentDate = new Date();
    let recentUpdates = 0;
    let veryRecentUpdates = 0;
    
    repositories.forEach(repo => {
      if (repo.updated_at) {
        const updatedDate = new Date(repo.updated_at);
        const daysAgo = Math.floor((currentDate.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysAgo <= 30) {
          veryRecentUpdates++;
        }
        if (daysAgo <= 90) {
          recentUpdates++;
        }
      }
    });
    
    let result = `**Development Activity:**\n`;
    result += `• Recently updated (30 days): ${veryRecentUpdates}/${repositories.length} repositories\n`;
    result += `• Active projects (90 days): ${recentUpdates}/${repositories.length} repositories\n`;
    
    // Activity assessment
    const veryRecentRatio = veryRecentUpdates / repositories.length;
    const recentRatio = recentUpdates / repositories.length;
    
    let activityLevel: string;
    if (veryRecentRatio > 0.7) {
      activityLevel = 'Very Active';
    } else if (recentRatio > 0.5) {
      activityLevel = 'Active';
    } else if (recentRatio > 0.3) {
      activityLevel = 'Moderate';
    } else {
      activityLevel = 'Low';
    }
    
    result += `• Overall activity level: ${activityLevel}\n`;
    result += `• Community health: ${['Very Active', 'Active'].includes(activityLevel) ? 'Strong' : 'Moderate'} developer engagement\n\n`;
    
    return result;
  }

  private _isTechQuery(query: string): boolean {
    const techIndicators = [
      'technology', 'framework', 'library', 'software', 'programming',
      'development', 'developer', 'code', 'github', 'open source',
      'javascript', 'python', 'react', 'nodejs', 'django', 'flask',
      'vue', 'angular', 'typescript', 'rust', 'go', 'kotlin',
      'adoption', 'popular', 'trending', 'tools', 'stack'
    ];
    
    const queryLower = query.toLowerCase();
    return techIndicators.some(indicator => queryLower.includes(indicator));
  }

  private async _rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = this.rateLimitDelay - timeSinceLastRequest;
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

export function createGitHubAgent(options: {
  speakerUri: string;
  serviceUrl: string;
  name?: string;
  organization?: string;
}): GitHubAgent {
  const {
    speakerUri,
    serviceUrl,
    name = 'GitHub Technology Agent',
    organization = 'OpenFloor Research'
  } = options;

  const manifest: ManifestOptions = {
    identification: {
      speakerUri,
      serviceUrl,
      organization,
      conversationalName: name,
      synopsis: 'Technology trends specialist for analyzing GitHub repositories and development adoption'
    },
    capabilities: [
      {
        keyphrases: [
          'technology', 'github', 'framework', 'library', 'programming',
          'development', 'trends', 'adoption', 'repositories', 'open source'
        ],
        descriptions: [
          'Analyze GitHub repositories for technology adoption trends',
          'Research programming frameworks and library popularity',
          'Assess development activity and community engagement metrics'
        ]
      }
    ]
  };

  return new GitHubAgent(manifest);
}