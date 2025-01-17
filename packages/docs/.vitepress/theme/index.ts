import DefaultTheme from 'vitepress/theme'
import HomePage from './components/HomePage.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp(ctx) {
    ctx.app.component('HomePage', HomePage)
  },
}
