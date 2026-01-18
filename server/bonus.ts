
interface UserBonus {
    userId: string;
    balance: number;
}

// In-memory store
const userBonuses: Map<string, number> = new Map();

// Seed default user
const DEFAULT_USER_ID = "user_123";
userBonuses.set(DEFAULT_USER_ID, 10.00); // £10.00 default bonus

export const bonusService = {
    getBalance: (userId: string = DEFAULT_USER_ID): number => {
        return userBonuses.get(userId) || 0;
    },

    redeem: (amount: number, userId: string = DEFAULT_USER_ID): boolean => {
        const currentBalance = userBonuses.get(userId) || 0;
        if (currentBalance >= amount) {
            userBonuses.set(userId, currentBalance - amount);
            return true;
        }
        return false;
    }
};
