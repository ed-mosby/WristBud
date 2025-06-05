import '../App.css'
import React from 'react'


const doSMS = () => {
  console.log("clicked")
}
const Test = () => {
  return (
    <div>
        <button onClick={() =>{doSMS()}}>
          Spread
        </button>
        <div className="test"></div>
    </div>
  )
}

export default Test