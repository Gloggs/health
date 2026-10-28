"use client"
import React, { useState, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import HelpGuide from './HelpGuide'

function HelpButton() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if this is the first visit to the dashboard
    const firstVisit = localStorage.getItem('dashboardVisited') === null
    setIsFirstVisit(firstVisit)
    
    // Set the visited flag in localStorage
    if (firstVisit) {
      localStorage.setItem('dashboardVisited', 'true')
      // Auto-show help guide on first visit after a slight delay
      const timer = setTimeout(() => {
        setHelpOpen(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [])
  
  const openHelpGuide = () => {
    setHelpOpen(true)
  }
  
  const dismissHelpGuide = () => {
    setHelpOpen(false)
  }
  
  if (!mounted) return null

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={openHelpGuide}
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Need help?</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <HelpGuide 
        open={helpOpen} 
        onClose={dismissHelpGuide} 
      />
    </>
  )
}

export default HelpButton 