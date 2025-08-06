import { Request, Response } from "express";
import prisma from "../config/prisma";

export const findUserByEmail = async (req: Request, res: Response) => {
  const { email } = req.query;
  const currentUserId = (req as any).user.id;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await prisma.user.findUnique({ where: { email: email.toString() } });

  if (!user || user.id === currentUserId) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({ user });
};

export const getAllUsersrs = async(req:Request,res:Response)=>{
  try {
    const users = await prisma.user.findMany();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}



export const searchUsers= async(req:Request,res:Response)=>{
 
  try {
    const currentUserId = (req as any).user.id;
    const {query} = req.query;
  
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return res.status(400).json({ message: "Search query too short" });
    }
  
    const users = await prisma.user.findMany({
      where:{
        id:{not:currentUserId},
        OR:[
          {name:{contains:query,mode:"insensitive"}},
          {email:{contains:query,mode:"insensitive"}},
          // {username:{contains:query,mode:"insensitive"}}, in future we can add username search
        ],
      },
      select:{
        id:true,
        name:true,
        email:true,
        avatar:true,
        fcmToken:true,
      },
      take:10,
    });
  
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}



export const updateProfile= async(req:Request,res:Response)=>{
 
  try {
    const userId = (req as any).user.id;
    
    if(!userId) return res.status(401).json({message:"Unauthorized"});
    const {name,bio,avatar,username} = req.body;
  
    const updatedUser = await prisma.user.update({
      where:{id:userId},
      data:{
        name,bio,avatar,username
      }
    });
  
    res.json({ user:updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}


export const updateFCMToken = async(req:Request,res:Response)=>{
 
  try {
    const userId = (req as any).user.id;
    const {token} = req.body;

    await prisma.user.update({
      where:{id:userId},
      data:{fcmToken:token}
    })

    res.json({message:"FCM token updated successfully"});
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}
