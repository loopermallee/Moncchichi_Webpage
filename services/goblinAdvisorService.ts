
import { aiService } from "./aiService";
import { brokerageService } from "./brokerageService";

class GoblinAdvisorService {
    
    public async getBeginnerGuidance(userQuery: string): Promise<string> {
        // 1. Get Context
        const portfolio = await brokerageService.getPortfolio();
        const cash = portfolio.cash.toFixed(2);
        const holdings = Object.entries(portfolio.holdings)
            .map(([sym, data]) => `${sym}: ${data.qty} shares @ $${data.avgPrice.toFixed(2)}`)
            .join(", ");

        const prompt = `
        You are Trade Prince Gallywix, a World of Warcraft Goblin running a trading brokerage.
        Your user is an ABSOLUTE BEGINNER to the stock market.
        
        Current Portfolio Simulation:
        Cash: ${cash} Gold (USD)
        Holdings: ${holdings || "None"}
        
        User Query: "${userQuery}"
        
        INSTRUCTIONS:
        1. Speak like a Goblin (greedy, funny, "Time is money", "Friend", mentions of explosions/gold).
        2. STRICTLY EDUCATIONAL. Do NOT give financial advice. Do NOT say "Buy AAPL".
        3. Explain CONCEPTS. If they ask about a stock, explain what the company does and what "volatility" means.
        4. If suggesting a strategy, label it clearly as [SIMULATION ONLY].
        5. Provide a "Risk Checklist" at the end (e.g., "Don't bet the whole Zeppelin!").
        
        Format the response with Markdown. Use bolding for emphasis.
        `;

        try {
            const response = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.7,
                systemInstruction: "You are a fictional Goblin Trade Prince teaching finance basics. Never give real investment advice."
            });
            return response.text;
        } catch (e) {
            return "The Scrying Orb is cloudy... try again later, friend! (AI Error)";
        }
    }

    public async getStockAnalysis(symbol: string): Promise<string> {
        const stock = brokerageService.getStockData(symbol);
        if (!stock) return "That ticker doesn't exist in my ledger!";

        const prompt = `
        Explain the stock "${symbol}" (${stock.name}) to a complete beginner.
        Current Mock Price: $${stock.price}.
        Sector: ${stock.sector}.
        
        1. What does this company actually do? (Explain simply)
        2. Why might it go up? (Bull case)
        3. Why might it explode? (Bear case - Risk)
        4. Goblin Verdict: Is it spicy or boring? (Just an opinion, not advice).
        
        Keep it short. Goblin persona active.
        `;

        try {
            const response = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.5
            });
            return response.text;
        } catch (e) {
            return "My runners couldn't find news on that one.";
        }
    }
}

export const goblinAdvisorService = new GoblinAdvisorService();
