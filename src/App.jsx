import { useState } from 'react'
import './App.css'
import DatasetGenerator from './components/DatasetGenerator'
import HealthPredictor from './components/HealthPredictor'
import ModelTrainer from './components/ModelTrainer'
import Test from './components/Test'
import './components/HealthPredictor.css'
import './components/ModelTrainer.css'
import './components/DatasetGenerator.css'
function App() { const [activeTab, setActiveTab] = useState('generator'); return ( <div className="App"> <header> <h1 style={{ color: '#888' }}>Health Analysis Tool</h1> <h2 style={{ color: '#888' }}>by: OACR</h2> </header> <nav className="app-nav"> <button className={`nav-btn ${activeTab === 'generator' ? 'active' : ''}`} onClick={() => setActiveTab('generator')} > GENERATE </button> <button className={`nav-btn ${activeTab === 'trainer' ? 'active' : ''}`} onClick={() => setActiveTab('trainer')} > TRAIN </button> <button className={`nav-btn ${activeTab === 'predictor' ? 'active' : ''}`} onClick={() => setActiveTab('predictor')} > PREDICT </button> <button className={`nav-btn ${activeTab === 'test' ? 'active' : ''}`} onClick={() => setActiveTab('test')} > Test Page </button> </nav> <main> { activeTab === 'generator' ? (<DatasetGenerator />) : activeTab === 'trainer' ? (<ModelTrainer />) : activeTab === 'test' ? (<Test/>) : (<HealthPredictor />) } </main> <footer> <p>&copy; Angelo</p> </footer> </div> )
} export default App