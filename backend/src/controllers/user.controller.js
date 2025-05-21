import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

export const getRecommendedUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentUser = req.user;

        // Get users who sent a friend request to the current user
        const incomingRequests = await FriendRequest.find({
        recipient: currentUserId,
        status: "pending"
        }).select("sender");

        // Extract sender IDs (people who sent you a request)
        const incomingSenderIds = incomingRequests.map(req => req.sender);

        const recommendedUsers = await User.find({
            $and: [
                { _id: {$ne: currentUserId} }, // exclude current user
                { _id: {$nin: currentUser.friends} }, // exclude current user's friends
                { _id: { $nin: incomingSenderIds } }, // exlude people who sent you a request
                {isOnboarded: true}
            ]
        });


        res.status(200).json(recommendedUsers);
    } catch (error) {
        console.error("Error in getRecommendedUsers controller", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getMyFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("friends").populate("friends", "fullName profilePic nativeLanguage learningLanguage");
        res.status(200).json(user.friends);
    } catch (error) {
        console.error("Error in getMyFriends controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export async function sendFriendRequest (req, res) {
    try {
        const myId = req.user.id;
        const { id:recipientId } = req.params;

        // prevent user from sending friend request to self
        if (myId === recipientId) return res.status(400).json({ message: "You cannot send friend request to yourself" });

        const recipient = await User.findById(recipientId);
        if (!recipient) return res.status(404).json({ message: "Recipient not found" });

        // check if user is already friends
        if(recipient.friends.includes(myId)) return res.status(400).json({ message: "You are already friends with this user" });

        // check if a request has already been sent
        const friendRequest = await FriendRequest.findOne({ $or: [{ sender: myId, recipient: recipientId }, { sender: recipientId, recipient: myId }] });
        if (friendRequest) return res.status(400).json({ message: "Friend request already sent" });

        const newFriendRequest = await FriendRequest.create({ sender: myId, recipient: recipientId });
        res.status(200).json(newFriendRequest);
    } catch (error) {
        console.error("Error in sendFriendRequest controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
    
}

export async function acceptFriendRequest(req, res) {
    try {
        const { id:requestId } = req.params;

        const friendRequest = await FriendRequest.findById(requestId);
        if (!friendRequest) return res.status(404).json({ message: "Friend request not found" });

        // verify the current user is the reciepent of the friend request
        if(friendRequest.recipient.toString() !== req.user.id) return res.status(401).json({ message: "Unauthorized" });

        const sender = await User.findById(friendRequest.sender);
        if (!sender) return res.status(404).json({ message: "Sender not found" });

        friendRequest.status = "accepted";
        await friendRequest.save();

        // add each user to the other's friends array
        await User.findByIdAndUpdate(friendRequest.sender, { $addToSet: { friends: friendRequest.recipient } }, { new: true });
        await User.findByIdAndUpdate(friendRequest.recipient, { $addToSet: { friends: friendRequest.sender } }, { new: true });

        res.status(200).json({ message: "Friend request accepted" });
    } catch (error) {
        console.error("Error in acceptFriendRequest controller:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getFriendRequests(req, res) {
    try {
        const incomingReqs = await FriendRequest.find({ recipient: req.user.id, status: "pending" }).populate("sender", "fullName profilePic nativeLanguage learningLanguage");
        const acceptedReqs = await FriendRequest.find({ sender: req.user.id, status: "accepted" }).populate("recipient", "fullName profilePic");

        res.status(200).json({ incomingReqs, acceptedReqs });
    } catch (error) {
        console.log("Error in getFriendRequests controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function getOutgoingFriendRequests(req, res) {
    try {
        const outgoingReqs = await FriendRequest.find({ sender: req.user.id, status: "pending" }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");

        res.status(200).json(outgoingReqs);
    } catch (error) {
        console.log("Error in getOutgoingFriendRequests controller:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}