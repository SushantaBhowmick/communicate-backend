import { Request, Response } from 'express';

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt';
import prisma from '../config/prisma';


export const register = async (req: Request, res: Response) => {
    // console.log("Hello World controller")
try {
    const {name,email,password} = req.body;

    const existingUser = await prisma.user.findUnique({where:{email}})

    if(existingUser) return res.status(400).json({message: 'User already exists'});

    const hashedPassword = await bcrypt.hash(password,10);

    const newUser = await prisma.user.create({data:{name,email,password:hashedPassword}});

    const token = generateToken(newUser.id);

    res.status(201).json({
        user:{id:newUser.id,name:newUser.name,email:newUser.email},
        token,
        message: 'User created successfully'
    })

} catch (error) {
    res.status(500).json({message: 'Internal server error'});
}
}

export const login = async (req: Request, res: Response) => {
    // console.log("Hello World controller")
try {
    const { email, password } = req.body;

   const user = await prisma.user.findUnique({where:{email}})

   if(!user) return res.status(400).json({message: 'Invalid credentials ci/cd testing'});

   const token = generateToken(user.id);

   res.status(200).json({
    user:{id:user.id,name:user.name,email:user.email},
    token,
    message: 'User logged in successfully ci/cd testing'
   })


} catch (error) {
    res.status(500).json({message: 'Internal server error'});
}
}